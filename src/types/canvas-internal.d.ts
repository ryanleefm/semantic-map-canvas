/**
 * Undocumented properties, intentionally unknown until checked at runtime.
 * Only CanvasAdapter may read these. No global Obsidian type augmentation.
 * Verified against the locally installed Obsidian 1.9.14 app bundle.
 */
export interface InternalCanvasView {
  readonly canvas?: unknown;
}

export interface InternalCanvas {
  /** log2 of the current animated scale; zero means 100%, NOT 0%. */
  readonly view?: unknown;
  readonly zoom?: unknown;
  readonly nodes?: unknown;
  readonly edges?: unknown;
}

export interface InternalCanvasNode {
  readonly canvas?: unknown;
  readonly nodeEl?: unknown;
  readonly labelEl?: unknown;
  readonly containerEl?: unknown;
  readonly isEditing?: unknown;
  readonly getData?: () => unknown;
}
