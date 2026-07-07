const API_BASE_URL = '';

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("ht-token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Auth endpoints ─────────────────────────────────────────────────────────────

export async function loginUser(email: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Login failed');
  }
  return await res.json();
}

export async function registerUser(email: string, password: string, family_name: string) {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, family_name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Registration failed');
  }
  return await res.json();
}

// ── Household ─────────────────────────────────────────────────────────────────

export async function getHousehold() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/household`, {
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (error) {
    console.error('Error fetching household:', error);
    return null;
  }
}

export async function getChatHistory(limit = 50) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/history?limit=${limit}`, { cache: 'no-store', headers: authHeaders() });
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return [];
  }
}

// ── Chat sessions ─────────────────────────────────────────────────────────────

export async function getSessions() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/sessions`, { cache: 'no-store', headers: authHeaders() });
    if (!res.ok) throw new Error('Sessions fetch failed');
    return await res.json();
  } catch { return []; }
}

export async function createSession(title = 'New chat') {
  return post('/api/chat/sessions', { title });
}

export async function renameSession(id: number, title: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error('Rename failed');
    return await res.json();
  } catch { return null; }
}

export async function deleteSession(id: number) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/sessions/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) throw new Error('Delete failed');
    return await res.json();
  } catch { return null; }
}

export async function getSessionMessages(sessionId: number, limit = 100) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/sessions/${sessionId}/messages?limit=${limit}`, { cache: 'no-store', headers: authHeaders() });
    if (!res.ok) throw new Error('Messages fetch failed');
    return await res.json();
  } catch { return []; }
}

export async function clearChatHistory() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/history`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (error) {
    console.error('Error clearing chat history:', error);
    return null;
  }
}

export async function getEmergencyCard(memberId: number) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/emergency/${memberId}/card`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (error) {
    console.error('Error fetching emergency card:', error);
    return null;
  }
}

export async function getMemberTwin(memberId: number) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/member/${memberId}/twin`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (error) {
    console.error('Error fetching member twin:', error);
    return null;
  }
}

export async function getMemberTimeline(memberId: number) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/member/${memberId}/timeline`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (error) {
    console.error('Error fetching member timeline:', error);
    return [];
  }
}

export async function getInsights() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/ai/insights`, { cache: 'no-store', headers: authHeaders() });
    if (!res.ok) throw new Error('Insights fetch failed');
    return await res.json() as { insights: import('./types').InsightItem[]; risk_bands: Record<string, import('./types').RiskBand> };
  } catch (error) {
    console.error('Error fetching insights:', error);
    return { insights: [], risk_bands: {} };
  }
}

export async function getBriefing() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/voice/briefing`, { cache: 'no-store', headers: authHeaders() });
    if (!res.ok) throw new Error('Briefing fetch failed');
    return await res.json();
  } catch (error) {
    console.error('Error fetching briefing:', error);
    return null;
  }
}

export async function getHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (error) {
    console.error('Error fetching health:', error);
    return null;
  }
}

export async function postVoiceConfirm(pending_id: string, confirmed: boolean) {
  return post("/api/voice/confirm", { pending_id, confirmed });
}

export async function postCareNotify(
  target: string,
  message: string,
  from_member = "HealthTwin",
  language = "en",
) {
  return post("/api/care/notify", { target, message, from_member, language });
}

export async function post(path: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (error) {
    console.error(`Error posting to ${path}:`, error);
    return null;
  }
}

export async function uploadFile(file: File, memberId?: string, kind?: string) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (memberId) formData.append('member_id', memberId);
    if (kind) formData.append('kind', kind);

    const res = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    return await res.json();
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

export async function confirmUpload(pendingId: string, edits?: any) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/upload/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        pending_id: pendingId,
        edits: edits || null,
      }),
    });
    if (!res.ok) throw new Error('Confirm failed');
    return await res.json();
    } catch (error) {
      console.error('Error confirming upload:', error);
      throw error;
    }
  }

export async function generateReport(
  type: string,
  memberId?: number | null,
  language: string = "en",
) {
  return post("/api/reports/generate", {
    type,
    ...(memberId != null ? { member_id: memberId } : {}),
    language,
  });
}

export async function createMember(data: any) {
    return await post(`/api/member`, data);
}

export async function updateMember(memberId: string | number, data: any) {
    const res = await fetch(`${API_BASE_URL}/api/member/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Update member failed');
    return await res.json();
}

export async function deleteMember(memberId: string | number) {
    const res = await fetch(`${API_BASE_URL}/api/member/${memberId}`, {
        method: 'DELETE',
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Delete member failed');
    return await res.json();
}

export async function mergeMembers(keepId: string | number, removeId: string | number) {
    return await post(`/api/member/${keepId}/merge`, { remove_id: Number(removeId) });
}

export async function addMedication(memberId: string | number, name: string, dose: string = "") {
    return await post(`/api/member/${memberId}/medication`, { name, dose });
}

export async function removeMedication(memberId: string | number, name: string) {
    const res = await fetch(`${API_BASE_URL}/api/member/${memberId}/medication/${encodeURIComponent(name)}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) throw new Error('Remove medication failed');
    return await res.json();
}

export async function addCondition(memberId: string | number, name: string) {
    return await post(`/api/member/${memberId}/condition`, { name });
}

export async function removeCondition(memberId: string | number, name: string) {
    const res = await fetch(`${API_BASE_URL}/api/member/${memberId}/condition/${encodeURIComponent(name)}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) throw new Error('Remove condition failed');
    return await res.json();
}

export async function addAllergy(memberId: string | number, name: string, reaction: string = "") {
    return await post(`/api/member/${memberId}/allergy`, { name, reaction });
}

export async function removeAllergy(memberId: string | number, name: string) {
    const res = await fetch(`${API_BASE_URL}/api/member/${memberId}/allergy/${encodeURIComponent(name)}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) throw new Error('Remove allergy failed');
    return await res.json();
}
