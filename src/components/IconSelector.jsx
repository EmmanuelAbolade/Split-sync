// src/components/IconSelector.jsx
import { 
  Home, Plane, Pizza, PartyPopper, Car, 
  Palmtree, Gamepad2, Heart, Users, 
  ShoppingCart, Coffee, Utensils, Music,
  Briefcase, GraduationCap, Gift
} from 'lucide-react';

const ICONS = [
  { name: 'home', Icon: Home, label: 'Home' },
  { name: 'plane', Icon: Plane, label: 'Travel' },
  { name: 'pizza', Icon: Pizza, label: 'Food' },
  { name: 'party', Icon: PartyPopper, label: 'Party' },
  { name: 'car', Icon: Car, label: 'Transport' },
  { name: 'beach', Icon: Palmtree, label: 'Beach' },
  { name: 'game', Icon: Gamepad2, label: 'Gaming' },
  { name: 'heart', Icon: Heart, label: 'Couple' },
  { name: 'users', Icon: Users, label: 'Friends' },
  { name: 'shopping', Icon: ShoppingCart, label: 'Shopping' },
  { name: 'coffee', Icon: Coffee, label: 'Coffee' },
  { name: 'dining', Icon: Utensils, label: 'Dining' },
  { name: 'music', Icon: Music, label: 'Music' },
  { name: 'work', Icon: Briefcase, label: 'Work' },
  { name: 'study', Icon: GraduationCap, label: 'Study' },
  { name: 'gift', Icon: Gift, label: 'Gift' },
];

export default function IconSelector({ selected, onSelect }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Choose Icon
      </label>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {ICONS.map(({ name, Icon, label }) => {
          const isSelected = selected === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onSelect(name)}
              title={label}
              className={`p-3 rounded-lg transition flex items-center justify-center ${
                isSelected
                  ? 'bg-primary text-white ring-2 ring-primary'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon size={24} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { ICONS };