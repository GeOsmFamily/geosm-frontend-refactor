import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { Group, SubGroup } from '../models/index';

@Injectable({ providedIn: 'root' })
export class GroupService {
  private readonly api = inject(ApiService);

  listGroups(instanceId: string): Observable<Group[]> {
    return this.api.get<Group[]>(`/instances/${instanceId}/groups`);
  }

  createGroup(instanceId: string, dto: Partial<Group>): Observable<Group> {
    return this.api.post<Group>(`/instances/${instanceId}/groups`, dto);
  }

  updateGroup(instanceId: string, id: string, dto: Partial<Group>): Observable<Group> {
    return this.api.patch<Group>(`/instances/${instanceId}/groups/${id}`, dto);
  }

  deleteGroup(instanceId: string, id: string): Observable<void> {
    return this.api.delete<void>(`/instances/${instanceId}/groups/${id}`);
  }

  reorderGroups(instanceId: string, orderedIds: string[]): Observable<Group[]> {
    return this.api.post<Group[]>(`/instances/${instanceId}/groups/reorder`, { orderedIds });
  }

  listSubGroups(groupId: string): Observable<SubGroup[]> {
    return this.api.get<SubGroup[]>(`/groups/${groupId}/sub-groups`);
  }

  createSubGroup(groupId: string, dto: Partial<SubGroup>): Observable<SubGroup> {
    return this.api.post<SubGroup>(`/groups/${groupId}/sub-groups`, dto);
  }

  updateSubGroup(groupId: string, id: string, dto: Partial<SubGroup>): Observable<SubGroup> {
    return this.api.patch<SubGroup>(`/groups/${groupId}/sub-groups/${id}`, dto);
  }

  deleteSubGroup(groupId: string, id: string): Observable<void> {
    return this.api.delete<void>(`/groups/${groupId}/sub-groups/${id}`);
  }
}
