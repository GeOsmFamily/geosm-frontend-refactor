import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import Map from 'ol/Map';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Fill, Stroke, Style, Icon, Text, Circle as CircleStyle } from 'ol/style';

import { MapService } from '../../map/services/map.service';
import { ToolActionService } from '../../../core/services/tool-action.service';
import { AuthService } from '../../../core/services/auth.service';
import { InstanceService } from '../../../core/services/instance.service';
import { CommentService } from '../../../core/services/comment.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

interface MapComment {
  id: string;
  text: string;
  lon: number;
  lat: number;
  feature: Feature;
}

@Component({
  selector: 'app-comment-tool',
  standalone: true,
  imports: [
    TranslateModule, 
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatDividerModule,
    MatListModule,
    MatSnackBarModule,
    MatCardModule,
  ],
  templateUrl: './comment-tool.component.html',
  styleUrl: './comment-tool.component.scss',
})
export class CommentToolComponent implements OnInit, OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly toolActionService = inject(ToolActionService);
  private readonly authService = inject(AuthService);
  private readonly instanceService = inject(InstanceService);
  private readonly commentService = inject(CommentService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  private map!: Map;
  private vectorSource!: VectorSource;
  private clickListener: ((evt: any) => void) | null = null;
  private authSubscription!: Subscription;

  readonly currentUser = this.authService.currentUser$;
  comments: MapComment[] = [];
  commentText = '';
  isPlacing = false;
  pendingCoord: [number, number] | null = null;

  ngOnInit(): void {
    this.map = this.mapService.getMap();
    this.vectorSource = this.mapService.commentSource;

    this.mapService.commentLayer.setStyle((feature) => {
      const features = feature.get('features') || [];
      const size = features.length;

      if (size > 1) {
        return new Style({
          image: new CircleStyle({
            radius: 15 + Math.min(size * 1.5, 12),
            fill: new Fill({ color: '#00ada7' }),
            stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
          }),
          text: new Text({
            text: size.toString(),
            fill: new Fill({ color: '#ffffff' }),
            font: 'bold 12px Roboto, sans-serif',
          }),
        });
      }

      const originalFeature = features[0] || feature;
      const label = (originalFeature.get('label') as string) || '';
      return new Style({
        image: new Icon({
          anchor: [0.5, 1],
          src: 'data:image/svg+xml,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="%23e53935" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>'
          ),
          scale: 1.5,
        }),
        text: label
          ? new Text({
              text: label.length > 20 ? label.substring(0, 20) + '...' : label,
              font: '12px sans-serif',
              fill: new Fill({ color: '#333' }),
              stroke: new Stroke({ color: '#fff', width: 3 }),
              offsetY: 12,
            })
          : undefined,
      });
    });

    this.toolActionService.action$.subscribe((action) => {
      if (action.tool === 'comment' && action.action === 'addAt') {
        this.pendingCoord = action.data as [number, number];
      }
    });

    this.authSubscription = this.currentUser.subscribe(user => {
      if (user) {
        this.loadComments();
      } else {
        this.vectorSource.clear();
        this.comments = [];
      }
    });
  }

  ngOnDestroy(): void {
    this.stopPlacing();
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  startPlacing(): void {
    this.stopPlacing();
    this.isPlacing = true;

    this.clickListener = (evt: any) => {
      const lonLat = toLonLat(evt.coordinate) as [number, number];
      this.pendingCoord = lonLat;
      this.isPlacing = false;
      if (this.clickListener) {
        this.map.un('singleclick', this.clickListener);
        this.clickListener = null;
      }
    };

    this.map.on('singleclick', this.clickListener);
  }

  stopPlacing(): void {
    if (this.clickListener) {
      this.map.un('singleclick', this.clickListener);
      this.clickListener = null;
    }
    this.isPlacing = false;
  }

  addComment(): void {
    const instance = this.instanceService.currentInstance$.value;
    if (!instance || !this.pendingCoord || !this.commentText.trim()) return;

    const [lon, lat] = this.pendingCoord;
    const text = this.commentText.trim();

    this.commentService.create({
      instanceId: instance.id,
      text,
      lat,
      lon,
    }).subscribe({
      next: (savedComment) => {
        const feature = new Feature(new Point(fromLonLat(this.pendingCoord!)));
        feature.set('label', text);
        feature.setId(`comment-${savedComment.id}`);
        this.vectorSource.addFeature(feature);

        this.comments.push({
          id: savedComment.id,
          text,
          lon,
          lat,
          feature,
        });

        this.commentText = '';
        this.pendingCoord = null;
        this.snackBar.open(
          this.translate.instant('shared.savedSuccessfully') || 'Commentaire enregistré avec succès',
          'OK',
          { duration: 3000 }
        );
      },
      error: () => {
        this.snackBar.open(
          this.translate.instant('shared.error') || 'Une erreur est survenue lors de l\'enregistrement',
          'OK',
          { duration: 3000 }
        );
      }
    });
  }

  navigateTo(comment: MapComment): void {
    this.mapService.zoomTo([comment.lon, comment.lat], 16);
  }

  deleteComment(comment: MapComment): void {
    this.commentService.delete(comment.id).subscribe({
      next: () => {
        this.vectorSource.removeFeature(comment.feature);
        this.comments = this.comments.filter(c => c.id !== comment.id);
        this.snackBar.open(
          this.translate.instant('shared.deletedSuccessfully') || 'Commentaire supprimé',
          'OK',
          { duration: 3000 }
        );
      },
      error: () => {
        this.snackBar.open(
          this.translate.instant('shared.error') || 'Une erreur est survenue',
          'OK',
          { duration: 3000 }
        );
      }
    });
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  private loadComments(): void {
    const instance = this.instanceService.currentInstance$.value;
    if (!instance) return;

    this.commentService.list(instance.id).subscribe({
      next: (data) => {
        this.vectorSource.clear();
        this.comments = [];
        data.forEach(c => {
          const feature = new Feature(new Point(fromLonLat([c.lon, c.lat])));
          feature.set('label', c.text);
          feature.setId(`comment-${c.id}`);
          this.vectorSource.addFeature(feature);

          this.comments.push({
            id: c.id,
            text: c.text,
            lon: c.lon,
            lat: c.lat,
            feature,
          });
        });
      },
      error: () => {
        this.vectorSource.clear();
        this.comments = [];
      }
    });
  }
}
