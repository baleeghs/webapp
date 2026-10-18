/**
 * Typed class variants for components, a few lines instead of a dependency:
 *
 *   const button = variants('base classes', {
 *     variant: { primary: '…', ghost: '…' },
 *     size: { sm: '…', md: '…' },
 *   }, { variant: 'primary', size: 'md' });
 *
 *   button({ size: 'sm' })            // base + primary + sm
 *   type Props = VariantProps<typeof button>   // { variant?: 'primary' | 'ghost'; size?: 'sm' | 'md' }
 */
type VariantConfig = Record<string, Record<string, string>>;

export type VariantSelection<V extends VariantConfig> = { [K in keyof V]?: keyof V[K] | null | undefined };

export interface VariantFn<V extends VariantConfig> {
  (selection?: VariantSelection<V>): string;
  readonly config: V;
}

export function variants<V extends VariantConfig>(
  base: string,
  config: V,
  defaults: { [K in keyof V]: keyof V[K] },
): VariantFn<V> {
  const fn = (selection: VariantSelection<V> = {}) => {
    const classes = [base];
    for (const key of Object.keys(config) as Array<keyof V>) {
      const chosen = selection[key] ?? defaults[key];
      classes.push(config[key]![chosen as string]!);
    }
    return classes.join(' ');
  };
  return Object.assign(fn, { config });
}

/** The props a variants function accepts, for spreading into a component's props. */
export type VariantProps<F> = F extends VariantFn<infer V> ? VariantSelection<V> : never;
