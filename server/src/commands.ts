// What the browser may ask the engine to do. File and export commands are not allowed here: they need their own checked routes.
import type { CommandStep } from './engine/Engine';

export class BadRequest extends Error {}

/** Commands the browser may send. File and export commands are not here: they need their own checked routes. */
const ALLOWED = /^((sketch|solid|mesh|parameters|timeline|model|edit|construct)\.[a-z0-9_.]+|body\.rename|browser\.visibility)$/;
// These engine commands can read or write paths (or read a font by path). File access goes through Forge's checked upload/download routes instead of
// the generic modelling endpoint. Keep this list explicit: some engine versions expose file operations outside `file.*`.
const FILE_COMMANDS = new Set([
  'sketch.export_dxf', 'sketch.insert_dxf', 'sketch.insert_svg',
  'parameters.export', 'parameters.import', 'timeline.export_script',
]);

/** Whether the browser (and an AI client) may run this command. */
export const isAllowedCommand = (id: string) => ALLOWED.test(id) && !FILE_COMMANDS.has(id);

/** A font may be named (an installed family such as "Arial", or the built-in one) but never given as a file: the engine would read any path it is handed. */
const looksLikeFile = (font: unknown) => typeof font === 'string' && /[\\/~%:]|\.(ttf|otf|ttc|woff2?)\s*$/i.test(font);

export function checkStep(s: any): CommandStep {
  if (!s || typeof s.command !== 'string' || !isAllowedCommand(s.command)) throw new BadRequest(`Command not allowed: ${String(s?.command).slice(0, 60)}`);
  if (s.params !== undefined && (typeof s.params !== 'object' || s.params === null || Array.isArray(s.params))) throw new BadRequest('"params" must be an object');
  if ((s.command === 'sketch.text' || s.command === 'sketch.edit_text') && s.params && (looksLikeFile(s.params.font) || (s.params.edits !== undefined && Array.isArray(s.params.edits) && s.params.edits.some((e: any) => looksLikeFile(e?.font))))) throw new BadRequest('Name an installed font (for example Arial); a font file cannot be used here');
  return { command: s.command, params: s.params };
}

