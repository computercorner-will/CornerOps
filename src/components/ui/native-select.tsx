import * as React from 'react';
import { cn } from '@/lib/utils';

/** A styled native <select>. Works in plain HTML forms and server components. */
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        'border-input dark:bg-input/30 h-9 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        '[&>option]:bg-background [&>option]:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
