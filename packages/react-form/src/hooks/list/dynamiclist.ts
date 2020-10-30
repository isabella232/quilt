import {useMemo, useEffect, ChangeEvent, useState} from 'react';
import isEqual from 'fast-deep-equal';

import {
  ValidationDictionary,
  Validator,
  NormalizedValidationDictionary,
  FieldStates,
  FieldDictionary,
  FieldState,
  ErrorValue,
  ListValidationContext,
} from '../../types';
import {mapObject, normalizeValidation, isChangeEvent} from '../../utilities';

import {
  updateAction,
  updateErrorAction,
  newDefaultAction,
  reinitializeAction,
  resetAction,
  useListReducer,
  addFieldsAction,
  removeFieldsAction,
} from './reducer';

export interface FieldListConfig {
  list: Item[];
  validates?: Partial<ValidationDictionary<Item, ListValidationContext<Item>>>;
}

interface Item {
  title: string;
  description: string;
}

interface DynamicList {
  fields: FieldDictionary<Item>[];
  addField(): void;
  removeField(index: number): void;
}

export function useDynamicList(
  validateFunction?: Partial<
    ValidationDictionary<Item, ListValidationContext<Item>>
  >,
  validationDependencies: unknown[] = [],
): DynamicList {
  const [calculatedList, setCalculatedLists] = useState<Item[]>([]);

  const validates = validateFunction ? validateFunction : {};
  console.log(calculatedList);
  const [state, dispatch] = useListReducer(calculatedList);

  useEffect(() => {
    if (!isEqual(calculatedList, state.initial)) {
      dispatch(reinitializeAction(calculatedList));
    }
  }, [calculatedList, state.initial, dispatch]);

  const validationConfigs = useMemo(
    () =>
      mapObject<NormalizedValidationDictionary<any>>(
        validates,
        normalizeValidation,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [validates, ...validationDependencies],
  );

  function addField() {
    const fields = calculatedList;
    fields.push();
    console.log(fields);
    setCalculatedLists(fields);
    dispatch(addFieldsAction([{title: '', description: ''}]));
  }

  function removeField(index: number) {
    dispatch(removeFieldsAction(index));
  }

  const handlers = useMemo(() => {
    return state.list.map((item, index) => {
      return mapObject<FieldDictionary<Item>>(
        item,
        <Key extends keyof Item & string>(
          field: FieldState<Item[Key]>,
          key: Key,
        ) => {
          const target = {index, key};

          function validate(value = field.value) {
            const validates = validationConfigs[key];

            if (validates == null) {
              return;
            }

            const siblings = state.list.filter(listItem => listItem !== item);

            return runValidation(
              error =>
                dispatch(
                  updateErrorAction<Item>({target, error: error || ''}),
                ),
              {value, siblings, listItem: item},
              validates,
            );
          }

          return {
            onChange(value: Item[Key] | ChangeEvent) {
              const normalizedValue = (isChangeEvent(value)
                ? value.target.value
                : value) as Item[Key];

              dispatch(
                updateAction({
                  target,
                  value: normalizedValue,
                }),
              );

              if (field.error) {
                validate(normalizedValue);
              }
            },
            reset() {
              dispatch(resetAction({target}));
            },
            newDefaultValue(value: Item[Key]) {
              dispatch(newDefaultAction({target, value}));
            },
            runValidation: validate,
            onBlur() {
              const {touched, error} = field;

              if (touched === false && error == null) {
                return;
              }
              validate();
            },
            setError(error: string) {
              dispatch(updateErrorAction({target, error}));
            },
          };
        },
      );
    });
  }, [dispatch, state.list, validationConfigs]);

  const fields: FieldDictionary<Item>[] = useMemo(() => {
    return state.list.map((item, index) => {
      return mapObject(item, (field, key: keyof Item) => {
        return {
          ...field,
          ...(handlers[index][key] as any),
        };
      });
    });
  }, [state.list, handlers]);
  return {fields, addField, removeField};
}

function runValidation<Value, Record extends object>(
  updateError: (error: ErrorValue) => void,
  state: {
    value: Value;
    listItem: FieldStates<Record>;
    siblings: FieldStates<Record>[];
  },
  validators: Validator<Value, ListValidationContext<Record>>[],
) {
  const {value, listItem, siblings} = state;

  const error = validators
    .map(check =>
      check(value, {
        listItem,
        siblings,
      }),
    )
    .filter(value => value != null);

  if (error && error.length > 0) {
    const [firstError] = error;
    updateError(firstError);
    return firstError;
  }

  updateError(undefined);
}
