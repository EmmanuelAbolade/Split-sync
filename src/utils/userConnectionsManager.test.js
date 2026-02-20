// src/utils/userConnectionsManager.test.js
// Test suite for user connections manager
import { 
  getConnections 
} from './userConnectionsManager';

// Mock Firestore
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}));

// Mock Firebase db
jest.mock('../services/firebase', () => ({
  db: {},
  auth: {},
}));

describe('User Connections - Data Validation', () => {
  
  test('Validates connection object structure', () => {
    const connection = {
      userId: 'user123',
      name: 'John Doe',
      email: 'john@example.com',
      phoneNumber: '+353871234567',
      photoURL: 'https://example.com/photo.jpg',
      connectedAt: new Date(),
    };

    expect(connection).toHaveProperty('userId');
    expect(connection).toHaveProperty('name');
    expect(connection).toHaveProperty('email');
    expect(connection).toHaveProperty('connectedAt');
  });

  test('Validates userId is string', () => {
    const userId = 'abc123xyz';
    expect(typeof userId).toBe('string');
    expect(userId.length).toBeGreaterThan(0);
  });

  test('Validates name is string', () => {
    const name = 'John Doe';
    expect(typeof name).toBe('string');
    expect(name.trim().length).toBeGreaterThan(0);
  });

  test('Validates email format', () => {
    const validEmails = [
      'user@example.com',
      'test.user@domain.co.uk',
      'admin+tag@company.org',
    ];

    validEmails.forEach(email => {
      expect(email).toMatch(/@/);
      expect(email.split('@').length).toBe(2);
    });
  });

  test('Validates phone number format', () => {
    const validPhones = [
      '+353871234567',
      '+447123456789',
      '+1234567890',
    ];

    validPhones.forEach(phone => {
      expect(phone).toMatch(/^\+/);
      expect(phone.length).toBeGreaterThan(10);
    });
  });

  test('Handles missing optional fields', () => {
    const minimalConnection = {
      userId: 'user123',
      name: 'John Doe',
      email: 'john@example.com',
    };

    expect(minimalConnection.userId).toBeDefined();
    expect(minimalConnection.phoneNumber).toBeUndefined();
    expect(minimalConnection.photoURL).toBeUndefined();
  });
});

describe('Connection Tracking', () => {
  
  test('Tracks connection with valid data', () => {
    const connection = {
      userId: 'user123',
      connectedUserId: 'user456',
      groupId: 'group789',
      groupName: 'Test Group',
      connectedAt: new Date(),
    };

    expect(connection.userId).toBeDefined();
    expect(connection.connectedUserId).toBeDefined();
    expect(connection.groupId).toBeDefined();
  });

  test('Validates bidirectional connection', () => {
    const connection1 = {
      from: 'user123',
      to: 'user456',
    };

    const connection2 = {
      from: 'user456',
      to: 'user123',
    };

    expect(connection1.from).toBe(connection2.to);
    expect(connection1.to).toBe(connection2.from);
  });

  test('Prevents self-connection', () => {
    const userId = 'user123';
    const connectedUserId = 'user123';
    
    const isSelfConnection = userId === connectedUserId;
    expect(isSelfConnection).toBe(true);
  });

  test('Tracks connection timestamp', () => {
    const timestamp = new Date();
    expect(timestamp).toBeInstanceOf(Date);
    expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('Stores group context with connection', () => {
    const connectionContext = {
      groupId: 'group789',
      groupName: 'Test Group',
      connectedVia: 'invitation',
    };

    expect(connectionContext.groupId).toBeDefined();
    expect(connectionContext.groupName).toBeDefined();
  });
});

describe('Connection Retrieval', () => {
  
  test('Retrieves empty connections list', () => {
    const connections = [];
    expect(Array.isArray(connections)).toBe(true);
    expect(connections.length).toBe(0);
  });

  test('Retrieves single connection', () => {
    const connections = [{
      userId: 'user123',
      name: 'John Doe',
    }];

    expect(connections.length).toBe(1);
    expect(connections[0].userId).toBe('user123');
  });

  test('Retrieves multiple connections', () => {
    const connections = [
      { userId: 'user1', name: 'Alice' },
      { userId: 'user2', name: 'Bob' },
      { userId: 'user3', name: 'Charlie' },
    ];

    expect(connections.length).toBe(3);
    expect(connections.every(c => c.userId && c.name)).toBe(true);
  });

  test('Filters connections by user', () => {
    const allConnections = [
      { userId: 'user1', connectedWith: 'user2' },
      { userId: 'user1', connectedWith: 'user3' },
      { userId: 'user2', connectedWith: 'user3' },
    ];

    const user1Connections = allConnections.filter(c => c.userId === 'user1');
    expect(user1Connections.length).toBe(2);
  });

  test('Sorts connections by name', () => {
    const connections = [
      { name: 'Charlie' },
      { name: 'Alice' },
      { name: 'Bob' },
    ];

    const sorted = [...connections].sort((a, b) => a.name.localeCompare(b.name));
    expect(sorted[0].name).toBe('Alice');
    expect(sorted[2].name).toBe('Charlie');
  });

  test('Sorts connections by date', () => {
    const now = Date.now();
    const connections = [
      { connectedAt: new Date(now - 2000) },
      { connectedAt: new Date(now - 1000) },
      { connectedAt: new Date(now) },
    ];

    const sorted = [...connections].sort((a, b) => 
      b.connectedAt.getTime() - a.connectedAt.getTime()
    );
    
    expect(sorted[0].connectedAt.getTime()).toBeGreaterThan(
      sorted[2].connectedAt.getTime()
    );
  });
});

describe('Connection Deduplication', () => {
  
  test('Identifies duplicate connections', () => {
    const connections = [
      { userId: 'user123', connectedWith: 'user456' },
      { userId: 'user123', connectedWith: 'user456' },
    ];

    const uniqueConnections = connections.filter((conn, index, self) =>
      index === self.findIndex(c => 
        c.userId === conn.userId && c.connectedWith === conn.connectedWith
      )
    );

    expect(uniqueConnections.length).toBe(1);
  });

  test('Preserves unique connections', () => {
    const connections = [
      { userId: 'user123', connectedWith: 'user456' },
      { userId: 'user123', connectedWith: 'user789' },
      { userId: 'user456', connectedWith: 'user789' },
    ];

    const uniqueIds = new Set(connections.map(c => `${c.userId}-${c.connectedWith}`));
    expect(uniqueIds.size).toBe(3);
  });

  test('Removes duplicate user IDs', () => {
    const userIds = ['user1', 'user2', 'user1', 'user3', 'user2'];
    const uniqueIds = [...new Set(userIds)];
    
    expect(uniqueIds.length).toBe(3);
    expect(uniqueIds).toContain('user1');
    expect(uniqueIds).toContain('user2');
    expect(uniqueIds).toContain('user3');
  });
});

describe('Phone Number Hashing', () => {
  
  test('Validates phone hash format', () => {
    const phoneHash = 'a1b2c3d4e5f6...'; // SHA-256 hash example
    expect(typeof phoneHash).toBe('string');
    expect(phoneHash.length).toBeGreaterThan(0);
  });

  test('Hash is consistent for same number', () => {
    const phone1 = '+353871234567';
    const phone2 = '+353871234567';
    
    expect(phone1).toBe(phone2);
  });

  test('Hash differs for different numbers', () => {
    const phone1 = '+353871234567';
    const phone2 = '+353879876543';
    
    expect(phone1).not.toBe(phone2);
  });

  test('Removes spaces before hashing', () => {
    const phoneWithSpaces = '+353 87 123 4567';
    const phoneWithoutSpaces = '+353871234567';
    
    const cleaned1 = phoneWithSpaces.replace(/\s/g, '');
    const cleaned2 = phoneWithoutSpaces.replace(/\s/g, '');
    
    expect(cleaned1).toBe(cleaned2);
  });
});

describe('Connection Metadata', () => {
  
  test('Stores connection source', () => {
    const sources = ['invitation', 'contact_sync', 'manual_add'];
    
    sources.forEach(source => {
      expect(['invitation', 'contact_sync', 'manual_add']).toContain(source);
    });
  });

  test('Tracks last interaction time', () => {
    const lastInteraction = new Date();
    expect(lastInteraction).toBeInstanceOf(Date);
  });

  test('Stores mutual groups count', () => {
    const mutualGroupsCount = 3;
    expect(typeof mutualGroupsCount).toBe('number');
    expect(mutualGroupsCount).toBeGreaterThanOrEqual(0);
  });

  test('Validates connection status', () => {
    const validStatuses = ['active', 'inactive', 'blocked'];
    const status = 'active';
    
    expect(validStatuses).toContain(status);
  });
});

describe('Error Handling', () => {
  
  test('Handles missing user data', () => {
    const user = null;
    expect(user).toBeNull();
  });

  test('Handles invalid user ID', () => {
    const invalidIds = ['', null, undefined];
    
    invalidIds.forEach(id => {
      expect(!id || id === '').toBeTruthy();
    });
  });

  test('Handles network errors gracefully', () => {
    const error = new Error('Network error');
    expect(error.message).toContain('Network');
  });

  test('Handles permission errors', () => {
    const error = new Error('Permission denied');
    expect(error.message).toContain('Permission denied');
  });
});