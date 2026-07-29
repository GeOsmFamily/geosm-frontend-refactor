import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  ElementRef,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Distingue les deux flux d'import déjà existants côté backend : un fichier de données
 * géospatial classique passe par le staging (StageFileImportUseCase), un projet QGIS complet
 * par son propre pipeline (UploadQgisProjectUseCase) - ce composant ne fait QUE détecter/
 * valider, il ne sait pas lui-même parler à l'API (réutilisé à la fois par l'assistant de
 * création d'instance et par l'outil "Importer mes données", qui n'ont pas le même
 * post-traitement une fois le fichier reçu).
 */
export type DroppedFileKind = 'data' | 'qgis-project';

export interface FileDropResult {
  file: File;
  kind: DroppedFileKind;
}

export interface FileDropRejection {
  file: File;
  reason: string;
}

const DATA_EXTENSIONS = ['.geojson', '.json', '.kml', '.gpkg', '.zip', '.csv'];
const QGIS_EXTENSIONS = ['.qgs', '.qgz'];

@Component({
  selector: 'app-file-drop-zone',
  standalone: true,
  imports: [CommonModule, MatIconModule, TranslateModule],
  templateUrl: './file-drop-zone.component.html',
  styleUrl: './file-drop-zone.component.scss',
})
export class FileDropZoneComponent {
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  /** Purement indicatif côté UI (attribut "accept" + message d'aide) - la vraie limite de
   * taille/format est toujours revalidée côté serveur (voir layer.routes.ts). */
  @Input() maxSizeMb = 200;
  @Input() multiple = false;
  @Input() hint = '';

  @Output() filesDropped = new EventEmitter<FileDropResult[]>();
  @Output() rejected = new EventEmitter<FileDropRejection[]>();

  readonly isDragOver = signal(false);
  readonly acceptAttr = [...DATA_EXTENSIONS, ...QGIS_EXTENSIONS].join(',');

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    const files = event.dataTransfer?.files;
    if (files?.length) this.handleFiles(Array.from(files));
  }

  openFilePicker(): void {
    this.fileInputRef.nativeElement.click();
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.handleFiles(Array.from(input.files));
    // Sans ça, redéposer le même fichier une seconde fois (ex. après correction) ne redéclenche
    // pas (change) puisque la valeur de l'input n'a, du point de vue du DOM, pas changé.
    input.value = '';
  }

  private handleFiles(files: File[]): void {
    const list = this.multiple ? files : files.slice(0, 1);
    const accepted: FileDropResult[] = [];
    const rejections: FileDropRejection[] = [];

    for (const file of list) {
      const kind = this.detectKind(file.name);
      if (!kind) {
        rejections.push({ file, reason: 'unsupportedFormat' });
        continue;
      }
      if (file.size > this.maxSizeMb * 1024 * 1024) {
        rejections.push({ file, reason: 'tooLarge' });
        continue;
      }
      accepted.push({ file, kind });
    }

    if (accepted.length) this.filesDropped.emit(accepted);
    if (rejections.length) this.rejected.emit(rejections);
  }

  private detectKind(filename: string): DroppedFileKind | null {
    const dot = filename.lastIndexOf('.');
    if (dot === -1) return null;
    const ext = filename.slice(dot).toLowerCase();
    if (QGIS_EXTENSIONS.includes(ext)) return 'qgis-project';
    if (DATA_EXTENSIONS.includes(ext)) return 'data';
    return null;
  }
}
