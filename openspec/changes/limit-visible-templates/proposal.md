# Proposal: Limit visible templates to ATS Corporate Style

## Summary

Temporarily show only the "ATS Corporate Style" template in the template picker,
hiding Modern, Classic, Minimal, and Custom — while keeping them in the codebase
so existing resumes that use them still render and export correctly.

## Problem

The other four templates aren't ready to offer to users yet, but they shouldn't
be deleted (existing resume versions may reference them, and they may be
re-enabled later).

## Goals

- Show only ATS Corporate Style in the template picker.
- Default new resume versions to ATS Corporate Style.
- Keep hidden templates fully functional for any existing resume that uses them
  (preview, PDF, DOCX, PPTX) and keep their display names available.
- Make re-enabling a template a one-line change.

## Non-goals

- No deletion of template code, ids, or types.
- No data migration of existing resumes.

## Success Criteria

- The picker lists only ATS Corporate Style.
- A new resume defaults to ATS Corporate Style.
- An existing resume saved with a hidden template still renders and exports.
- Un-hiding a template requires only removing its `hidden` flag.
