import * as React from 'react';
import styles from './Button.module.css';

interface ButtonProps {
  onPress: () => void;
  children: React.ReactNode;
}

export default function Button({ onPress, children }: ButtonProps) {
  return (
    <button className={styles.button} onClick={onPress} type="button">
      {children}
    </button>
  );
}
