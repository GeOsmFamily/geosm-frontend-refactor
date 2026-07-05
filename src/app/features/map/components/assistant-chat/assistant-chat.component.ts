import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import Feature from 'ol/Feature';
import GeoJSONFormat from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style';

import { AssistantService, AssistantChatTurn, AssistantClientAction, AssistantAttachment, AssistantConversationSummary } from '../../../../core/services/assistant.service';
import { InstanceService } from '../../../../core/services/instance.service';
import { AnalyticsService } from '../../../../core/services/analytics.service';
import { LayerService } from '../../../../core/services/layer.service';
import { LocationPlanService } from '../../../../core/services/location-plan.service';
import { MapLayerService } from '../../services/map-layer.service';
import { MapService } from '../../services/map.service';

interface DisplayMessage extends AssistantChatTurn {
  attachments?: AssistantAttachment[];
}

const WELCOME_TEXT = 'Bonjour ! Je peux vous aider à explorer la carte : activer des couches, chercher un lieu, générer un plan de localisation, calculer une zone tampon... Que puis-je faire pour vous ?';

@Component({
  selector: 'app-assistant-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './assistant-chat.component.html',
  styleUrl: './assistant-chat.component.scss',
})
export class AssistantChatComponent implements OnInit, OnDestroy {
  private readonly assistantService = inject(AssistantService);
  private readonly instanceService = inject(InstanceService);
  private readonly layerService = inject(LayerService);
  private readonly locationPlanService = inject(LocationPlanService);
  private readonly mapLayerService = inject(MapLayerService);
  private readonly mapService = inject(MapService);
  private readonly analyticsService = inject(AnalyticsService);

  @ViewChild('messagesEnd') private messagesEnd?: ElementRef<HTMLDivElement>;

  readonly conversations = signal<AssistantConversationSummary[]>([]);
  readonly activeConversationId = signal<string | null>(null);
  readonly messages = signal<DisplayMessage[]>([{ role: 'model', text: WELCOME_TEXT }]);
  readonly sending = signal(false);
  readonly loadingConversation = signal(false);
  readonly downloadingId = signal<string | null>(null);
  readonly mapResultVisible = signal(false);
  inputText = '';

  private resultLayer: VectorLayer<VectorSource> | null = null;

  ngOnDestroy(): void {
    // Le calque de résultat (buffer/analyse spatiale affiché par l'assistant) est ajouté
    // directement à la carte partagée (MapService) - sans ce nettoyage, il resterait affiché
    // indéfiniment après la fermeture du panneau assistant, invisible/impossible à retirer.
    if (this.resultLayer) {
      this.mapService.removeLayer(this.resultLayer);
      this.resultLayer = null;
    }
  }

  ngOnInit(): void {
    const instance = this.instanceService.currentInstance$.value;
    if (!instance) return;

    this.assistantService.listConversations(instance.id).subscribe({
      next: (list) => {
        this.conversations.set(list);
        if (list.length > 0) {
          this.selectConversation(list[0].id);
        } else {
          this.startNewConversation();
        }
      },
      error: () => this.startNewConversation(),
    });
  }

  startNewConversation(): void {
    const instance = this.instanceService.currentInstance$.value;
    if (!instance) return;

    this.assistantService.createConversation(instance.id).subscribe((conv) => {
      this.conversations.update((list) => [{ id: conv.id, title: conv.title, updatedAt: conv.updatedAt }, ...list]);
      this.activeConversationId.set(conv.id);
      this.messages.set([{ role: 'model', text: WELCOME_TEXT }]);
    });
  }

  selectConversation(id: string): void {
    if (this.activeConversationId() === id) return;
    this.activeConversationId.set(id);
    this.loadingConversation.set(true);
    this.assistantService.getConversation(id).subscribe({
      next: (conv) => {
        this.messages.set(conv.messages.length > 0 ? conv.messages : [{ role: 'model', text: WELCOME_TEXT }]);
        this.loadingConversation.set(false);
        this.scrollToBottom();
      },
      error: () => {
        this.loadingConversation.set(false);
      },
    });
  }

  deleteConversation(id: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.assistantService.deleteConversation(id).subscribe({
      next: () => {
        const remaining = this.conversations().filter((c) => c.id !== id);
        this.conversations.set(remaining);
        if (this.activeConversationId() === id) {
          if (remaining.length > 0) {
            this.activeConversationId.set(null);
            this.selectConversation(remaining[0].id);
          } else {
            this.startNewConversation();
          }
        }
      },
      error: () => {
        // Pas de retour visuel dédié pour l'instant en cas d'échec - au moins ne pas laisser
        // l'observable planter silencieusement (cause du bug où le bouton semblait ne rien faire).
      },
    });
  }

  clearMapResult(): void {
    this.resultLayer?.getSource()?.clear();
    this.mapResultVisible.set(false);
  }

  send(): void {
    const text = this.inputText.trim();
    const instance = this.instanceService.currentInstance$.value;
    const conversationId = this.activeConversationId();
    if (!text || this.sending() || !instance || !conversationId) return;

    this.messages.update((m) => [...m, { role: 'user', text }]);
    this.inputText = '';
    this.sending.set(true);
    this.scrollToBottom();
    this.analyticsService.trackEvent({ instanceId: instance.id, eventType: 'assistant_message_sent' }).subscribe({ error: () => {} });

    this.assistantService.chat(instance.id, conversationId, text).subscribe({
      next: (result) => {
        this.messages.update((m) => [...m, { role: 'model', text: result.reply || '...', attachments: result.attachments }]);
        this.executeClientActions(instance.id, result.clientActions);
        this.refreshConversationSummary(conversationId, text);
        this.sending.set(false);
        this.scrollToBottom();
      },
      error: () => {
        this.messages.update((m) => [...m, { role: 'model', text: 'Désolé, une erreur est survenue. Réessayez.' }]);
        this.sending.set(false);
        this.scrollToBottom();
      },
    });
  }

  downloadAttachment(attachment: AssistantAttachment): void {
    if (!attachment.downloadUrl || this.downloadingId()) return;
    this.downloadingId.set(attachment.id);
    this.locationPlanService.download(attachment.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileTitle = attachment.title ? attachment.title.toLowerCase().replace(/\s+/g, '-') : 'plan-localisation';
        a.download = `${fileTitle}-${Date.now()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingId.set(null);
      },
      error: () => {
        this.downloadingId.set(null);
      },
    });
  }

  private refreshConversationSummary(conversationId: string, firstMessageIfNew: string): void {
    this.conversations.update((list) => {
      const idx = list.findIndex((c) => c.id === conversationId);
      if (idx === -1) return list;
      const updated = { ...list[idx], updatedAt: new Date().toISOString() };
      if (updated.title === 'Nouvelle conversation') updated.title = firstMessageIfNew.slice(0, 60);
      const rest = list.filter((c) => c.id !== conversationId);
      return [updated, ...rest];
    });
  }

  private executeClientActions(instanceId: string, actions: AssistantClientAction[]): void {
    for (const action of actions) {
      if (action.action === 'activateLayer' && action.layerId) {
        this.layerService.getById(instanceId, action.layerId).subscribe((layer) => {
          this.mapLayerService.addLayer(layer);
        });
      } else if (action.action === 'deactivateLayer' && action.layerId) {
        this.mapLayerService.removeLayer(action.layerId);
      } else if (action.action === 'zoomTo' && action.lon != null && action.lat != null) {
        this.mapService.zoomTo([action.lon, action.lat], action.zoom ?? 14);
      } else if (action.action === 'displayGeometry' && action.geometry) {
        this.displayGeometry(action.geometry);
      }
    }
  }

  private displayGeometry(geometry: GeoJSON.Geometry): void {
    if (!this.resultLayer) {
      this.resultLayer = this.mapService.addVectorLayer(
        'assistant-result',
        [],
        new Style({
          stroke: new Stroke({ color: '#00ada7', width: 3, lineDash: [8, 4] }),
          fill: new Fill({ color: 'rgba(0, 173, 167, 0.18)' }),
          image: new CircleStyle({ radius: 7, stroke: new Stroke({ color: '#00ada7', width: 2 }), fill: new Fill({ color: '#ffffff' }) }),
        }),
      );
    }
    const format = new GeoJSONFormat();
    const olGeometry = format.readGeometry(geometry, { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' });
    const source = this.resultLayer.getSource()!;
    source.clear();
    source.addFeature(new Feature(olGeometry));
    this.mapService.getMap().getView().fit(olGeometry.getExtent(), { padding: [80, 80, 80, 80], maxZoom: 16, duration: 400 });
    this.mapResultVisible.set(true);
  }

  private scrollToBottom(): void {
    setTimeout(() => this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' }), 100);
  }
}
