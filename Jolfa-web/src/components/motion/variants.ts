import type { Variants, Transition } from 'framer-motion'

export const durations = {
  fast: 0.15,
  normal: 0.25,
  slow: 0.4,
}

export const easings = {
  outExpo: [0.16, 1, 0.3, 1] as const,
  spring: { type: 'spring' as const, damping: 25, stiffness: 300 },
  bounce: { type: 'spring' as const, damping: 17, stiffness: 400 },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: durations.normal, ease: easings.outExpo } },
  exit: { opacity: 0, transition: { duration: durations.fast, ease: easings.outExpo } },
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: durations.slow, ease: easings.outExpo } },
  exit: { opacity: 0, y: 8, transition: { duration: durations.fast, ease: easings.outExpo } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: durations.normal, ease: easings.outExpo },
  },
  exit: { opacity: 0, scale: 0.96, transition: { duration: durations.fast, ease: easings.outExpo } },
}

export const slideInFromRight: Variants = {
  hidden: { x: '100%' },
  visible: { x: 0, transition: easings.spring },
  exit: { x: '100%', transition: { ...easings.spring, damping: 30 } },
}

export const slideInFromLeft: Variants = {
  hidden: { x: '-100%' },
  visible: { x: 0, transition: easings.spring },
  exit: { x: '-100%', transition: { ...easings.spring, damping: 30 } },
}

export const slideInFromTop: Variants = {
  hidden: { y: '-100%' },
  visible: { y: 0, transition: easings.spring },
  exit: { y: '-100%', transition: { ...easings.spring, damping: 30 } },
}

export const slideInFromBottom: Variants = {
  hidden: { y: '100%' },
  visible: { y: 0, transition: easings.spring },
  exit: { y: '100%', transition: { ...easings.spring, damping: 30 } },
}

export const dialogBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: durations.normal } },
  exit: { opacity: 0, transition: { duration: durations.fast } },
}

export const dialogContent: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: durations.slow, ease: easings.outExpo },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 8,
    transition: { duration: durations.fast, ease: easings.outExpo },
  },
}

export const sheetBackdrop: Variants = dialogBackdrop

export const toastEnter: Variants = {
  hidden: { opacity: 0, y: -16, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: durations.normal, ease: easings.outExpo },
  },
  exit: { opacity: 0, y: -8, scale: 0.96, transition: { duration: durations.fast } },
}

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.normal, ease: easings.outExpo },
  },
}

export function createHoverLiftTransition(): Transition {
  return { type: 'spring', stiffness: 300, damping: 20 }
}
