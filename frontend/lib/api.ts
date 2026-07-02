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
