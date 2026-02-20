// src/utils/balanceCalculator.test.js
// Test suite for balance calculation logic
import { calculateBalances, calculateSettlements, getUserBalanceSummary } from './balanceCalculator';

describe('Balance Calculator', () => {
  
  // Test 1: Equal split divides correctly
  test('Equal split divides amount evenly among participants', () => {
    const expenses = [{
      id: '1',
      amount: 300,
      paidBy: 'user1',
      participants: ['user1', 'user2', 'user3'],
      splits: {
        user1: 100,
        user2: 100,
        user3: 100
      }
    }];
    
    const members = [
      { userId: 'user1', name: 'Alice' },
      { userId: 'user2', name: 'Bob' },
      { userId: 'user3', name: 'Charlie' }
    ];
    
    const balances = calculateBalances(expenses, members);
    
    // Alice paid 300, owes 100, balance = +200
    expect(balances['user1']).toBe(200);
    // Bob owes 100
    expect(balances['user2']).toBe(-100);
    // Charlie owes 100
    expect(balances['user3']).toBe(-100);
  });

  // Test 2: Percentage split
  test('Percentage split calculates correct amounts', () => {
    const expenses = [{
      id: '2',
      amount: 100,
      paidBy: 'user1',
      participants: ['user1', 'user2', 'user3'],
      splits: {
        user1: 50, // 50%
        user2: 30, // 30%
        user3: 20  // 20%
      }
    }];
    
    const members = [
      { userId: 'user1', name: 'Alice' },
      { userId: 'user2', name: 'Bob' },
      { userId: 'user3', name: 'Charlie' }
    ];
    
    const balances = calculateBalances(expenses, members);
    
    // Alice paid 100, owes 50, balance = +50
    expect(balances['user1']).toBe(50);
    // Bob owes 30
    expect(balances['user2']).toBe(-30);
    // Charlie owes 20
    expect(balances['user3']).toBe(-20);
  });

  // Test 3: Exact amounts split
  test('Exact amounts split assigns specific values', () => {
    const expenses = [{
      id: '3',
      amount: 150,
      paidBy: 'user1',
      participants: ['user1', 'user2', 'user3'],
      splits: {
        user1: 50,
        user2: 75,
        user3: 25
      }
    }];
    
    const members = [
      { userId: 'user1', name: 'Alice' },
      { userId: 'user2', name: 'Bob' },
      { userId: 'user3', name: 'Charlie' }
    ];
    
    const balances = calculateBalances(expenses, members);
    
    // Alice paid 150, owes 50, balance = +100
    expect(balances['user1']).toBe(100);
    // Bob owes 75
    expect(balances['user2']).toBe(-75);
    // Charlie owes 25
    expect(balances['user3']).toBe(-25);
  });

  // Test 4: Multiple expenses aggregate correctly
  test('Multiple expenses aggregate balances correctly', () => {
    const expenses = [
      {
        id: '1',
        amount: 100,
        paidBy: 'user1',
        participants: ['user1', 'user2'],
        splits: {
          user1: 50,
          user2: 50
        }
      },
      {
        id: '2',
        amount: 200,
        paidBy: 'user2',
        participants: ['user1', 'user2'],
        splits: {
          user1: 100,
          user2: 100
        }
      }
    ];
    
    const members = [
      { userId: 'user1', name: 'Alice' },
      { userId: 'user2', name: 'Bob' }
    ];
    
    const balances = calculateBalances(expenses, members);
    
    // Alice: paid 100, owes 150 (50 + 100), balance = -50
    expect(balances['user1']).toBe(-50);
    // Bob: paid 200, owes 150 (50 + 100), balance = +50
    expect(balances['user2']).toBe(50);
  });

  // Test 5: Unequal split (one person pays more)
  test('Unequal split calculates different amounts per person', () => {
    const expenses = [{
      id: '1',
      amount: 100,
      paidBy: 'user1',
      participants: ['user1', 'user2', 'user3'],
      splits: {
        user1: 10,
        user2: 40,
        user3: 50
      }
    }];
    
    const members = [
      { userId: 'user1', name: 'Alice' },
      { userId: 'user2', name: 'Bob' },
      { userId: 'user3', name: 'Charlie' }
    ];
    
    const balances = calculateBalances(expenses, members);
    
    // Alice paid 100, owes 10, balance = +90
    expect(balances['user1']).toBe(90);
    // Bob owes 40
    expect(balances['user2']).toBe(-40);
    // Charlie owes 50
    expect(balances['user3']).toBe(-50);
  });

  // Test 6: Zero balance member
  test('Member with no expenses has zero balance', () => {
    const expenses = [{
      id: '1',
      amount: 100,
      paidBy: 'user1',
      participants: ['user1', 'user2'],
      splits: {
        user1: 50,
        user2: 50
      }
    }];
    
    const members = [
      { userId: 'user1', name: 'Alice' },
      { userId: 'user2', name: 'Bob' },
      { userId: 'user3', name: 'Charlie' }
    ];
    
    const balances = calculateBalances(expenses, members);
    
    // Charlie wasn't in any expense
    expect(balances['user3']).toBe(0);
  });
});

describe('Settlement Calculator', () => {
  
  // Test 1: Simple two-person settlement
  test('Calculates simple settlement between two people', () => {
    const balances = {
      user1: 50,  // Alice is owed 50
      user2: -50  // Bob owes 50
    };
    
    const settlements = calculateSettlements(balances);
    
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({
      from: 'user2',
      to: 'user1',
      amount: 50
    });
  });

  // Test 2: Multiple people settlement
  test('Minimizes transactions in multi-person settlement', () => {
    const balances = {
      user1: 100,  // Alice is owed 100
      user2: -30,  // Bob owes 30
      user3: -70   // Charlie owes 70
    };
    
    const settlements = calculateSettlements(balances);
    
    // Should create 2 settlements (Bob->Alice, Charlie->Alice)
    expect(settlements).toHaveLength(2);
    
    // Total amounts should balance
    const totalPaid = settlements.reduce((sum, s) => sum + s.amount, 0);
    expect(totalPaid).toBe(100);
  });

  // Test 3: Everyone settled up
  test('Returns empty array when everyone is settled', () => {
    const balances = {
      user1: 0,
      user2: 0,
      user3: 0
    };
    
    const settlements = calculateSettlements(balances);
    
    expect(settlements).toHaveLength(0);
  });

  // Test 4: Complex settlement optimization
  test('Optimizes complex multi-creditor scenario', () => {
    const balances = {
      user1: 100,  // Alice is owed 100
      user2: 50,   // Bob is owed 50
      user3: -150  // Charlie owes 150
    };
    
    const settlements = calculateSettlements(balances);
    
    // Charlie should pay both Alice and Bob
    expect(settlements).toHaveLength(2);
    expect(settlements.find(s => s.to === 'user1')).toBeDefined();
    expect(settlements.find(s => s.to === 'user2')).toBeDefined();
  });
});

describe('User Balance Summary', () => {
  
  const members = [
    { userId: 'user1', name: 'Alice' },
    { userId: 'user2', name: 'Bob' }
  ];

  // Test 1: User is owed money
  test('Returns correct summary when user is owed money', () => {
    const balances = { user1: 50, user2: -50 };
    
    const summary = getUserBalanceSummary(balances, 'user1', members);
    
    expect(summary.status).toBe('owed');
    expect(summary.amount).toBe(50);
    expect(summary.message).toBe('You are owed');
  });

  // Test 2: User owes money
  test('Returns correct summary when user owes money', () => {
    const balances = { user1: 50, user2: -50 };
    
    const summary = getUserBalanceSummary(balances, 'user2', members);
    
    expect(summary.status).toBe('owes');
    expect(summary.amount).toBe(50);
    expect(summary.message).toBe('You owe');
  });

  // Test 3: User is settled up
  test('Returns settled status when balance is zero', () => {
    const balances = { user1: 0, user2: 0 };
    
    const summary = getUserBalanceSummary(balances, 'user1', members);
    
    expect(summary.status).toBe('settled');
    expect(summary.amount).toBe(0);
    expect(summary.message).toBe('All settled up!');
  });

  // Test 4: Handles very small balances (rounding)
  test('Treats very small balances as settled', () => {
    const balances = { user1: 0.005, user2: -0.005 };
    
    const summary = getUserBalanceSummary(balances, 'user1', members);
    
    expect(summary.status).toBe('settled');
  });
});