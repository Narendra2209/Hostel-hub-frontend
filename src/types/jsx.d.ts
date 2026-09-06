/**
 * React 19 removed the ambient global `JSX` namespace in favour of `React.JSX`.
 * Re-exposing it globally keeps `JSX.Element` working as a return type across
 * the codebase without annotating every component with `React.JSX.Element`.
 */
import type { JSX as ReactJSX } from 'react';

declare global {
  // These interfaces exist purely to re-expose React's JSX types under the
  // global name; they are declaration merges, so they are empty by design.
  /* eslint-disable @typescript-eslint/no-empty-object-type */
  namespace JSX {
    type Element = ReactJSX.Element;
    type ElementType = ReactJSX.ElementType;
    type ElementClass = ReactJSX.ElementClass;
    interface IntrinsicElements extends ReactJSX.IntrinsicElements {}
    interface IntrinsicAttributes extends ReactJSX.IntrinsicAttributes {}
    interface ElementAttributesProperty extends ReactJSX.ElementAttributesProperty {}
    interface ElementChildrenAttribute extends ReactJSX.ElementChildrenAttribute {}
  }
  /* eslint-enable @typescript-eslint/no-empty-object-type */
}

export {};
