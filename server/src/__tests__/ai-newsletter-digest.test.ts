import { describe, it, expect, vi } from 'vitest';
import { generateDailyDigestForUser } from '../services/ai/newsletter-digest.service.js';
import { aiRepository } from '../repositories/ai.repository.js';

describe('Daily Executive & Newsletter Digest Service', () => {
  it('should generate fallback digest structure when newsletters and urgent items are empty', async () => {
    vi.spyOn(aiRepository, 'getNewslettersForUser').mockResolvedValue([]);
    vi.spyOn(aiRepository, 'getUrgentEmailsForUser').mockResolvedValue([]);
    vi.spyOn(aiRepository, 'getUserPreferences').mockResolvedValue(null as any);
    vi.spyOn(aiRepository, 'saveDailyDigest').mockImplementation(async (data: any) => ({
      id: 'mock-digest-1',
      ...data,
      digestDate: new Date().toISOString().split('T')[0],
      createdAt: new Date(),
    }));

    const result = await generateDailyDigestForUser('user-test-123');

    expect(result).toBeDefined();
    expect(result.executiveGreeting).toBeDefined();
    expect(Array.isArray(result.newsletterTopics)).toBe(true);
    expect(Array.isArray(result.actionSummary)).toBe(true);
  });

  it('should format urgent action summaries into high-priority digest items', async () => {
    const mockUrgent = [
      {
        emailId: 'em-1',
        subject: 'Important: Submit Semester Grades',
        sender: 'Registrar Office',
        oneSentenceSummary: 'Final grades must be submitted before Friday 5 PM.',
        extractedTasks: [{ id: 'task-1', title: 'Submit Grades', priority: 'high' }],
      },
    ];

    vi.spyOn(aiRepository, 'getNewslettersForUser').mockResolvedValue([]);
    vi.spyOn(aiRepository, 'getUrgentEmailsForUser').mockResolvedValue(mockUrgent as any);
    vi.spyOn(aiRepository, 'getUserPreferences').mockResolvedValue(null as any);
    vi.spyOn(aiRepository, 'saveDailyDigest').mockImplementation(async (data: any) => ({
      id: 'mock-digest-2',
      ...data,
      digestDate: new Date().toISOString().split('T')[0],
      createdAt: new Date(),
    }));

    const result = await generateDailyDigestForUser('user-test-123');

    expect(result.actionSummary.length).toBeGreaterThanOrEqual(1);
    expect(result.actionSummary[0].from).toEqual('Registrar Office');
    expect(result.actionSummary[0].urgency.toLowerCase()).toEqual('high');
  });
});
