import * as Clipboard from 'expo-clipboard';
import { File } from 'expo-file-system';
import type { useRouter } from 'expo-router';

import { parseOpml, setOpmlDraft } from '@/feed/opml';
import { showDialog } from '@/ui/Dialog';

type Router = ReturnType<typeof useRouter>;

/** Opens the import checklist for an OPML document, or explains why not. */
export function openOpmlChecklist(xml: string, router: Router): void {
  const outlines = parseOpml(xml);
  if (outlines.length === 0) {
    showDialog('No podcasts found', "That doesn't look like an OPML subscription list.");
    return;
  }
  setOpmlDraft(outlines);
  router.push('/opml-import');
}

/** AntennaPod's "Import OPML file": the system file picker, then the checklist. */
export async function importOpmlFile(router: Router): Promise<void> {
  try {
    // Android labels .opml files inconsistently (text/xml, text/x-opml or
    // octet-stream), so accept any file and judge it by its contents.
    const picked = await File.pickFileAsync({ mimeTypes: '*/*' });
    if (!picked || picked.canceled) return;
    openOpmlChecklist(await picked.result.text(), router);
  } catch (error) {
    showDialog("Couldn't read that file", error instanceof Error ? error.message : String(error));
  }
}

/** The same checklist, from an OPML document on the clipboard. */
export async function importOpmlFromClipboard(router: Router): Promise<void> {
  openOpmlChecklist(await Clipboard.getStringAsync(), router);
}
