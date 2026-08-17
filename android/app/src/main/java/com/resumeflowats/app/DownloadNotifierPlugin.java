package com.resumeflowats.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.app.NotificationCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.OutputStream;

// Real "download" behavior for the WebView shell: writes an exported file into
// the public Downloads collection via MediaStore (no storage permission needed
// on API 29+) and posts a download-complete notification that opens the file.
//
// The web side (lib/nativeDownload.ts) treats any rejection — pre-Q device,
// notification permission denied, MediaStore failure — as "unavailable" and
// falls back to the cache-file + share-sheet path, so every error here is
// recoverable by the caller.
@CapacitorPlugin(
    name = "DownloadNotifier",
    permissions = @Permission(
        strings = { Manifest.permission.POST_NOTIFICATIONS },
        alias = DownloadNotifierPlugin.NOTIFICATIONS
    )
)
public class DownloadNotifierPlugin extends Plugin {

    static final String NOTIFICATIONS = "notifications";
    private static final String CHANNEL_ID = "downloads";

    @PluginMethod
    public void save(PluginCall call) {
        // MediaStore.Downloads exists only on API 29+; older devices use the
        // caller's share-sheet fallback.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("MediaStore.Downloads requires Android 10", "UNSUPPORTED");
            return;
        }
        // Ask for notification permission BEFORE saving: if the user denies,
        // we reject without writing anything and the caller's share sheet
        // remains the one visible completion signal.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && getPermissionState(NOTIFICATIONS) != PermissionState.GRANTED) {
            requestPermissionForAlias(NOTIFICATIONS, call, "notificationsCallback");
            return;
        }
        doSave(call);
    }

    @PermissionCallback
    private void notificationsCallback(PluginCall call) {
        if (getPermissionState(NOTIFICATIONS) == PermissionState.GRANTED) {
            doSave(call);
        } else {
            call.reject("Notification permission denied", "PERMISSION_DENIED");
        }
    }

    private void doSave(PluginCall call) {
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String data = call.getString("data");
        if (fileName == null || fileName.isEmpty() || data == null) {
            call.reject("fileName and data are required");
            return;
        }

        byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("data is not valid base64");
            return;
        }

        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
        values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
        values.put(MediaStore.Downloads.IS_PENDING, 1);
        // MediaStore auto-deduplicates the display name ("resume (1).pdf").
        Uri item = resolver.insert(
            MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY),
            values
        );
        if (item == null) {
            call.reject("Could not create the download entry");
            return;
        }
        try (OutputStream out = resolver.openOutputStream(item)) {
            if (out == null) throw new IOException("null output stream");
            out.write(bytes);
        } catch (IOException e) {
            resolver.delete(item, null, null);
            call.reject("Could not write the file: " + e.getMessage());
            return;
        }
        values.clear();
        values.put(MediaStore.Downloads.IS_PENDING, 0);
        resolver.update(item, values, null, null);

        notifyComplete(fileName, mimeType, item);

        JSObject ret = new JSObject();
        ret.put("uri", item.toString());
        call.resolve(ret);
    }

    private void notifyComplete(String fileName, String mimeType, Uri uri) {
        Context ctx = getContext();
        NotificationManager manager =
            (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        manager.createNotificationChannel(new NotificationChannel(
            CHANNEL_ID,
            ctx.getString(R.string.download_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT
        ));

        Intent open = new Intent(Intent.ACTION_VIEW);
        open.setDataAndType(uri, mimeType);
        open.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent tap = PendingIntent.getActivity(
            ctx,
            uri.hashCode(),
            open,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        manager.notify(uri.hashCode(), new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle(fileName)
            .setContentText(ctx.getString(R.string.download_complete))
            .setContentIntent(tap)
            .setAutoCancel(true)
            .build());
    }
}
