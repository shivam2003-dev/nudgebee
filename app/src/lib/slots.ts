// Frontend extension-point registry. EE bundles register components into
// neutrally-named slots from package init (via @ee/init blank-import in
// _app.tsx). OSS code calls renderSlot to materialize whatever's
// registered, or null when nothing is — which is the OSS steady state.
//
// Slot names describe layout position, not feature. An OSS reader sees a
// neutral slot, not a hint about what EE puts there.
import React, { type ComponentType, type ReactElement } from 'react';

export type SlotName = 'LayoutHeaderAction' | 'SignInProviderExtra' | 'Branding';

const slots = new Map<SlotName, ComponentType<any>>();

export function registerSlot<P>(name: SlotName, component: ComponentType<P>): void {
  slots.set(name, component as ComponentType<any>);
}

export function renderSlot<P = Record<string, never>>(name: SlotName, props?: P): ReactElement | null {
  const Component = slots.get(name);
  if (!Component) return null;
  return React.createElement(Component, props as Record<string, unknown>);
}

export function hasSlot(name: SlotName): boolean {
  return slots.has(name);
}
