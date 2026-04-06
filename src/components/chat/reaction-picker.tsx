import * as React from 'react';
import EmojiPicker, { en } from 'rn-emoji-keyboard';

import { colors } from '@/components/ui';

type Props = {
  onSelect: (emoji: string) => void;
  onDismiss: () => void;
};

/** Dark theme aligned with app `colors` — rn-emoji-keyboard uses string color tokens. */
const REACTION_THEME = {
  backdrop: 'rgba(0,0,0,0.55)',
  knob: colors.text[800],
  container: colors.background[900],
  header: colors.text[50],
  skinTonesContainer: colors.background[925],
  category: {
    icon: colors.text[800],
    iconActive: colors.accent[100],
    container: 'transparent',
    containerActive: colors.background[925],
  },
  search: {
    background: colors.background[950],
    text: colors.text[50],
    placeholder: colors.text[800],
    icon: colors.text[800],
  },
  customButton: {
    icon: colors.text[800],
    iconPressed: colors.text[50],
    background: colors.background[925],
    backgroundPressed: colors.background[900],
  },
  emoji: {
    selected: colors.accent[100],
  },
};

/**
 * Full Unicode emoji picker (search, categories, skin tones). Mount only when open
 * so list rows do not each keep a heavy picker instance.
 */
export function ReactionPicker({ onSelect, onDismiss }: Props) {
  return (
    <EmojiPicker
      open
      onClose={onDismiss}
      onRequestClose={onDismiss}
      onEmojiSelected={(e) => onSelect(e.emoji)}
      translation={en}
      theme={REACTION_THEME}
      enableSearchBar
      enableRecentlyUsed
      expandable
      defaultHeight="42%"
      expandedHeight="70%"
      categoryPosition="bottom"
    />
  );
}
