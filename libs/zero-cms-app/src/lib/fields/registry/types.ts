import type { Control } from 'react-hook-form';
import type { Field } from '@usc/zero-cms-core';

/** The value shape react-hook-form drives for a whole entry form. */
export type FormValues = Record<string, unknown>;

/** Props every field renderer receives: the field def + the RHF control. */
export interface RendererProps {
  field: Field;
  control: Control<FormValues>;
}
