import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

export interface AssistantChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface AssistantClientAction {
  action: 'activateLayer' | 'deactivateLayer' | 'zoomTo' | 'displayGeometry';
  layerId?: string;
  layerName?: string;
  lon?: number;
  lat?: number;
  zoom?: number;
  geometry?: GeoJSON.Geometry;
  label?: string;
}

export interface AssistantAttachment {
  type: 'location-plan';
  id: string;
  title: string;
  status: string;
  downloadUrl?: string;
}

export interface AssistantChatResult {
  conversationId: string;
  reply: string;
  clientActions: AssistantClientAction[];
  attachments: AssistantAttachment[];
}

export interface AssistantConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface AssistantConversationDetail extends AssistantConversationSummary {
  messages: AssistantChatTurn[];
}

@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  chat(instanceId: string, conversationId: string, message: string): Observable<AssistantChatResult> {
    return this.api.post<AssistantChatResult>('/assistant/chat', { instanceId, conversationId, message });
  }

  listConversations(instanceId: string): Observable<AssistantConversationSummary[]> {
    return this.api.get<AssistantConversationSummary[]>('/assistant/conversations', { instanceId });
  }

  createConversation(instanceId: string): Observable<AssistantConversationDetail> {
    return this.api.post<AssistantConversationDetail>('/assistant/conversations', { instanceId });
  }

  getConversation(id: string): Observable<AssistantConversationDetail> {
    return this.api.get<AssistantConversationDetail>(`/assistant/conversations/${id}`);
  }

  deleteConversation(id: string): Observable<void> {
    // Le backend renvoie 204 No Content - ApiService.delete() attend une enveloppe JSON
    // { data } et échoue silencieusement sur un corps vide (même contournement que
    // GeosignetService.delete()).
    return this.http.delete(`${this.baseUrl}/assistant/conversations/${id}`, { observe: 'response' }).pipe(
      map(() => undefined as void),
    );
  }
}
