# Admin page navigation

The workspace offers a page search in the desktop sidebar and in the mobile More menu. It searches the shared navigation destinations, section names and common task words. For example, Facebook finds Social links, privacy finds Content publishing, and refund finds both Returns and Payments. This searches page destinations, not customer or order records.

Social links has a direct entry in Storefront. Named child destinations take precedence over their parent section when marking the active page, so Social links does not also select Store setup.

Search uses native labelled inputs and normal links. Tab moves to results; Escape clears the query. On mobile a second Escape closes More, and selecting a result closes the menu. Empty searches show the regular navigation; unmatched terms show a no-results message. Search clears on page changes.

Acceptance checks: desktop and mobile search, task aliases, empty results, Escape, correct active destination, navigation closing More, and mobile horizontal overflow. Backend permissions and data are unchanged.
