type SelectionKey = Pick<
  KeyboardEvent,
  | "key"
  | "ctrlKey"
  | "metaKey"
  | "altKey"
  | "repeat"
  | "isComposing"
  | "defaultPrevented"
>;
/** Delete applies only to a selected object, never to a text or action control. */
export function isSelectionDelete(
  event: SelectionKey,
  target: Pick<Element, "closest"> | null,
) {
  return (
    ["Delete", "Backspace"].includes(event.key) &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.repeat &&
    !event.isComposing &&
    !event.defaultPrevented &&
    !!target &&
    !target.closest(
      'input,textarea,select,[contenteditable],[role="textbox"],button,a[href]',
    )
  );
}
