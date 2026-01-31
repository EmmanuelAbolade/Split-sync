// src/components/PasswordStrength.jsx
import { useState, useEffect } from 'react';
import { Check, X, RefreshCw } from 'lucide-react';

export default function PasswordStrength({ password, onPasswordGenerate }) {
  const [strength, setStrength] = useState({ score: 0, label: 'Weak', color: 'red' });

  useEffect(() => {
    calculateStrength(password);
  }, [password]);

  const calculateStrength = (pwd) => {
    if (!pwd) {
      setStrength({ score: 0, label: 'Weak', color: 'red' });
      return;
    }

    let score = 0;
    
    // Length check
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    
    // Character variety
    if (/[a-z]/.test(pwd)) score++; // lowercase
    if (/[A-Z]/.test(pwd)) score++; // uppercase
    if (/[0-9]/.test(pwd)) score++; // numbers
    if (/[^A-Za-z0-9]/.test(pwd)) score++; // special chars

    // Determine strength
    if (score <= 2) {
      setStrength({ score, label: 'Weak', color: 'red' });
    } else if (score <= 4) {
      setStrength({ score, label: 'Medium', color: 'yellow' });
    } else {
      setStrength({ score, label: 'Strong', color: 'green' });
    }
  };

  const generatePassword = () => {
    // Generate strong password: Word + Number + Special + Word
    const words = ['Split', 'Sync', 'Share', 'Group', 'Easy', 'Fast', 'Safe', 'Smart'];
    const specials = ['!', '@', '#', '$', '&', '*'];
    
    const word1 = words[Math.floor(Math.random() * words.length)];
    const word2 = words[Math.floor(Math.random() * words.length)];
    const number = Math.floor(Math.random() * 999) + 100;
    const special = specials[Math.floor(Math.random() * specials.length)];
    
    const generated = `${word1}${number}${special}${word2}`;
    onPasswordGenerate(generated);
  };

  const requirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter (a-z)', met: /[a-z]/.test(password) },
    { label: 'Number (0-9)', met: /[0-9]/.test(password) },
    { label: 'Special character (!@#$)', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const strengthColors = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
  };

  const strengthTextColors = {
    red: 'text-red-600',
    yellow: 'text-yellow-600',
    green: 'text-green-600',
  };

  return (
    <div className="mt-2">
      {/* Strength Bar */}
      {password && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600">Password Strength:</span>
            <span className={`text-xs font-semibold ${strengthTextColors[strength.color]}`}>
              {strength.label}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${strengthColors[strength.color]} transition-all duration-300`}
              style={{ width: `${(strength.score / 6) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Generate Password Button */}
      <button
        type="button"
        onClick={generatePassword}
        className="flex items-center gap-2 text-sm text-primary hover:text-primary-dark transition mb-3"
      >
        <RefreshCw size={14} />
        <span>Generate Strong Password</span>
      </button>

      {/* Requirements Checklist */}
      {password && (
        <div className="space-y-1">
          {requirements.map((req, index) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              {req.met ? (
                <Check size={14} className="text-green-600" />
              ) : (
                <X size={14} className="text-gray-400" />
              )}
              <span className={req.met ? 'text-green-600' : 'text-gray-500'}>
                {req.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
