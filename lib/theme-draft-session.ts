/** Fetching a newer history must never silently authorize saving an older editor. */
export function draftSaveBlocked(editorBase:number|null,serverBase:number|null){
 return editorBase===null||serverBase===null||editorBase!==serverBase;
}
