'use client';

import React, { useState } from 'react';
import Header from './navigation/Header';
import MobileDrawer from './navigation/MobileDrawer';

export default function Navbar() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <Header onToggleMobileDrawer={() => setIsDrawerOpen(true)} />
      <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </>
  );
}
