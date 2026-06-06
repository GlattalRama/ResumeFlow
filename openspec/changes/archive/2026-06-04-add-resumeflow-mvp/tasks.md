# Tasks: ResumeFlow MVP

## 1. Project setup

- [x] Create base layout and navigation.
- [x] Create data folder.
- [x] Create JSON files.

## 2. Types and JSON store

- [x] Create /lib/types.ts.
- [x] Create /lib/jsonStore.ts.
- [x] Add read JSON helper.
- [x] Add write JSON helper.
- [x] Add create item helper.
- [x] Add update item helper.
- [x] Add delete item helper.
- [x] Auto-create missing JSON files.

## 3. Resume builder

- [x] Create resume form.
- [x] Create resume list page.
- [x] Create resume create page.
- [x] Create resume edit page.
- [x] Create resume preview page.
- [x] Add live preview.
- [x] Add print/download PDF using browser print.

## 4. Resume templates

- [x] Add selectedTemplate field to ResumeVersion.
- [x] Create ResumeTemplate type.
- [x] Create ModernTemplate component.
- [x] Create ClassicTemplate component.
- [x] Create MinimalTemplate component.
- [x] Create CustomTemplate component.
- [x] Create CtsTemplate component.
- [x] Create ResumeTemplateRenderer component.
- [x] Add template selector cards.
- [x] Show templates: Modern, Classic, Minimal, Custom, CTS.
- [x] Update live preview when template changes.
- [x] Store selected template in resumes.json.
- [x] Use selected template when printing/downloading PDF.

## 5. Resume versioning

- [x] Create new resume version.
- [x] Edit resume version.
- [x] Duplicate resume version.
- [x] Save resume version to JSON.
- [x] Load resume version from JSON.

## 6. Job applications

- [x] Create application list page.
- [x] Create application form.
- [x] Create application detail page.
- [x] Create application edit page.
- [x] Add create application API.
- [x] Add edit application API.
- [x] Link application to resume version.
- [x] Add status badge.
- [x] Add status update support.

## 7. Notes

- [x] Add notes JSON store.
- [x] Add notes section to application detail page.
- [x] Add note creation.
- [x] Show notes newest first.
- [x] Support note types.

## 8. Interview Q&A

- [x] Add Q&A JSON store.
- [x] Add Q&A section.
- [x] Add manual Q&A creation.
- [x] Add edit answer support.
- [x] Add practiced checkbox.
- [x] Group Q&A by category.

## 9. Status history

- [x] Store status changes.
- [x] Add status history timeline.
- [x] Record old status, new status, changed date, and comment.

## 10. Documents metadata

- [x] Add documents JSON store.
- [x] Add documents section.
- [x] Store document metadata only.
- [x] Link documents to application and resume version.

## 11. Dashboard

- [x] Show total resume versions.
- [x] Show total applications.
- [x] Show applications by status.
- [x] Show recent applications.
- [x] Add quick action buttons.

## 12. AI placeholders

- [x] Add Generate Interview Q&A button.
- [x] Add Tailor Resume for this Job button.
- [x] Add Generate Interview Briefing button.
- [x] Add Generate Cover Letter button.
- [x] Add Generate Follow-up Message button.
- [x] Use placeholder logic only.

## 13. Sample data

- [x] Add 2 resume versions.
- [x] Add 3 job applications.
- [x] Add sample notes.
- [x] Add sample Q&A.
- [x] Add sample status history.

## 14. Final checks

- [x] Run TypeScript checks.
- [x] Test resume template switching.
- [x] Test resume CRUD.
- [x] Test application CRUD.
- [x] Test notes.
- [x] Test Q&A.
- [x] Confirm npm run dev works.

## 15. CTS Areas of Expertise

- [x] Add areasOfExpertise field to ResumeData.
- [x] Add Areas of Expertise input section in resume form.
- [x] Render Areas of Expertise in CTS template.
- [x] Render Areas of Expertise as two-column bullet list in CTS template.
- [x] Hide Areas of Expertise section when no data exists.
- [x] Save areasOfExpertise in resumes.json.
- [x] Load areasOfExpertise from resumes.json.


## 16. Profile photo support

- [x] Add profilePhoto field to ResumeData.
- [x] Add profile photo upload field in resume form.
- [x] Convert selected photo to Base64 for MVP storage.
- [x] Show photo preview in resume form.
- [x] Add remove photo option.
- [x] Save profilePhoto in resumes.json.
- [x] Load profilePhoto from resumes.json.
- [x] Render profile photo in CTS template header.
- [x] Hide photo area or show placeholder when no photo exists.
- [x] Ensure print/download PDF includes the selected profile photo.


## 17. Template font and color customization

- [x] Add TemplateStyleSettings type.
- [x] Add templateStyle field to ResumeVersion.
- [x] Add default style settings for CTS template.
- [x] Add font selector in resume builder.
- [x] Add primary color selector.
- [x] Add body color selector.
- [x] Add muted color selector.
- [x] Add section line color selector.
- [x] Apply selected font and colors to live preview.
- [x] Save templateStyle in resumes.json.
- [x] Load templateStyle from resumes.json.
- [x] Ensure CTS template uses selected font and colors.
- [x] Make style settings reusable for other templates.

## 18. Export resume in PDF, DOCX, and PPTX

- [x] Keep existing PDF export.
- [x] Add DOCX export support.
- [x] Add PPTX export support.
- [x] Add Download PDF button for all templates.
- [x] Add Download DOCX button for all templates.
- [x] Add Download PPTX button for all templates.
- [x] Export selected resume JSON data to DOCX.
- [x] Export selected resume JSON data to PPTX.
- [x] Preserve selected template style settings in DOCX export.
- [x] Preserve selected template style settings in PPTX export.
- [x] Ensure exports work for Modern template.
- [x] Ensure exports work for Classic template.
- [x] Ensure exports work for Minimal template.
- [x] Ensure exports work for Custom template.
- [x] Ensure exports work for CTS template.

## 19. Collapsible and rearrangeable resume form cards

- [x] Create reusable collapsible card component.
- [x] Apply collapsible behavior to Template Selector card.
- [x] Apply collapsible behavior to Font & Colors card.
- [x] Apply collapsible behavior to Version card.
- [x] Apply collapsible behavior to Basics card.
- [x] Apply collapsible behavior to Summary card.
- [x] Apply collapsible behavior to Areas of Expertise card.
- [x] Apply collapsible behavior to Work Experience card.
- [x] Apply collapsible behavior to Education card.
- [x] Apply collapsible behavior to Certifications card.
- [x] Apply collapsible behavior to Languages card.
- [x] Apply collapsible behavior to Technical Skills card.
- [x] Add ability to rearrange form cards.
- [x] Save form card collapsed state in resumes.json.
- [x] Save form card order in resumes.json.
- [x] Load form card state from resumes.json.
- [x] Ensure rearranging builder cards does not break resume preview.

## 20. Areas of Expertise card improvements

- [x] Add one-by-one expertise item entry.
- [x] Add edit support for each expertise item.
- [x] Add remove support for each expertise item.
- [x] Add move up/down support for expertise items.
- [x] Add bullet style selector.
- [x] Support bullet styles: bullet, dash, check, arrow, none.
- [x] Save areasOfExpertiseBulletStyle in resumes.json.
- [x] Load areasOfExpertiseBulletStyle from resumes.json.
- [x] Render Areas of Expertise as balanced two-column layout.
- [x] Ensure two-column layout works in CTS template.
- [x] Ensure two-column layout works in all templates where Areas of Expertise is shown.
- [x] Ensure PDF export preserves bullet style and two-column layout.
- [x] Ensure DOCX export uses bullet style as much as possible.
- [x] Ensure PPTX export uses bullet style as much as possible.

## 21. Editable resume section labels

- [x] Add defaultTitle and customTitle to ResumeSectionState.
- [x] Add edit label option to resume content cards.
- [x] Allow user to rename Summary section.
- [x] Allow user to rename Areas of Expertise section.
- [x] Allow user to rename Work Experience section.
- [x] Allow user to rename Technical Skills section.
- [x] Allow user to rename Education section.
- [x] Allow user to rename Certifications section.
- [x] Allow user to rename Languages section.
- [x] Save custom section labels in resumes.json.
- [x] Load custom section labels from resumes.json.
- [x] Show custom labels in builder card headers.
- [x] Show custom labels in live preview.
- [x] Use custom labels in PDF export.
- [x] Use custom labels in DOCX export.
- [x] Use custom labels in PPTX export.
- [x] Add reset-to-default label option.

