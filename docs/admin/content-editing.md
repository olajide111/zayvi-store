# Content editing

The editor labels unsaved changes, saved drafts and published content separately. Publishing requires a saved revision; edits must be saved before publishing. Explanatory text identifies the target country and makes clear that saving is not publishing. Character counts show the summary/body limits. Draft preview is marked as an unpublished view and renders plain text with preserved line breaks.

Ctrl+S or Command+S saves a draft while focus is inside the editor form. It uses the same validation and saving state as Save draft; it never publishes. Opening preview focuses its heading.

While there are unsaved changes, ordinary same-tab links within the admin workspace use Keep editing / Discard changes, including sidebar and mobile navigation. During an update, those links are temporarily blocked. Modified clicks and links opening a new tab keep normal browser behaviour. A browser beforeunload warning covers refresh, tab close and full-page departure where supported. Browsers control that warning and may suppress it; internal browser Back/Forward transitions are not intercepted by this link guard. Changes are not automatically saved.

Checks cover sidebar keep/discard, refresh cancellation, keyboard save, save-before-publish gating, publication messages, country-labelled text-safe preview and phone layout. Backend publishing and permissions are unchanged.
