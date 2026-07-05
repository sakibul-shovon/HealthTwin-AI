const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export async function getHousehold() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/household`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (error) {
    console.error('Error fetching household:', error);
    return null;
  }
}

export async function getChatHistory(limit = 50) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/history?limit=${limit}`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return [];
  }
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
    const res = await fetch(`${API_BASE_URL}/api/member/${memberId}/twin`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (error) {
    console.error('Error fetching member twin:', error);
    return null;
  }
}

export async function getMemberTimeline(memberId: number) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/member/${memberId}/timeline`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (error) {
    console.error('Error fetching member timeline:', error);
    return [];
  }
}

export async function getInsights() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/ai/insights`);
    if (!res.ok) throw new Error('Insights fetch failed');
    return await res.json() as { insights: import('./types').InsightItem[]; risk_bands: Record<string, import('./types').RiskBand> };
  } catch (error) {
    console.error('Error fetching insights:', error);
    return { insights: [], risk_bands: {} };
  }
}

export async function getBriefing() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/voice/briefing`);
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
      headers: {
        'Content-Type': 'application/json',
      },
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
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Update member failed');
    return await res.json();
}

export async function deleteMember(memberId: string | number) {
    const res = await fetch(`${API_BASE_URL}/api/member/${memberId}`, {
        method: 'DELETE',
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
    const res = await fetch(`${API_BASE_URL}/api/member/${memberId}/medication/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Remove medication failed');
    return await res.json();
}

export async function addCondition(memberId: string | number, name: string) {
    return await post(`/api/member/${memberId}/condition`, { name });
}

export async function removeCondition(memberId: string | number, name: string) {
    const res = await fetch(`${API_BASE_URL}/api/member/${memberId}/condition/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Remove condition failed');
    return await res.json();
}

export async function addAllergy(memberId: string | number, name: string, reaction: string = "") {
    return await post(`/api/member/${memberId}/allergy`, { name, reaction });
}

export async function removeAllergy(memberId: string | number, name: string) {
    const res = await fetch(`${API_BASE_URL}/api/member/${memberId}/allergy/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Remove allergy failed');
    return await res.json();
}
