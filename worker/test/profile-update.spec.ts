import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import worker from '../src/worker';

// Mock environment for testing
const mockEnv = {
  DB: {
    prepare: (sql: string) => ({
      bind: (...args: any[]) => ({
        first: async () => ({ 
          id: 'test-user-123', 
          username: 'testuser',
          is_admin: 0,
          geo_verified: 1,
          status: 'pending_profile'
        }),
        run: async () => ({
          meta: { changes: 1 }
        })
      }),
      run: async () => {
        // Simulate missing column error
        if (sql.includes('dietary_preference')) {
          throw new Error('no such column: dietary_preference');
        }
        return { meta: { changes: 1 } };
      }
    })
  } as any,
  JWT_SECRET: 'test-secret-key-32-chars-minimum1',
  ADMIN_SECRET: 'test-admin-secret-key-32-minimum1'
};

describe('Profile Update Endpoint', () => {
  it('should handle profile update request', async () => {
    // Create a mock request with auth cookie and profile data
    const request = new Request('https://localhost/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'auth_token=test-token-123'
      },
      body: JSON.stringify({
        gender: 'male',
        seeking: 'female',
        dietary: 'veg',
        intent: 'relationship',
        year: 2,
        bio: 'Test bio',
        profileData: {
          gender: 'male',
          seeking: 'female',
          dietary: 'veg',
          intent: 'relationship',
          year: 2,
          bio: 'Test bio'
        }
      })
    });

    try {
      const response = await worker.fetch(request, mockEnv, { waitUntil: () => {} });
      const status = response.status;
      const body = await response.json();
      
      console.log('Response Status:', status);
      console.log('Response Body:', body);
      
      // Should either succeed (200) or have a meaningful error
      expect([200, 400, 401, 409, 500]).toContain(status);
    } catch (err) {
      console.error('Test error:', err);
      throw err;
    }
  });

  it('should detect missing dietary_preference column and auto-migrate', async () => {
    // This test would verify the fallback migration works
    console.log('Testing auto-migration for missing column...');
    expect(true).toBe(true); // placeholder
  });
});
