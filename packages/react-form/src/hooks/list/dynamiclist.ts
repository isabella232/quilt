import {useMemo, useEffect} from 'react';
import isEqual from 'fast-deep-equal';

import {NormalizedValidationDictionary, FieldDictionary} from '../../types';
import {mapObject, normalizeValidation} from '../../utilities';

import {
  reinitializeAction,
  useListReducer,
  addFieldsAction,
  removeFieldsAction,
} from './reducer';
import {FieldListConfig} from './list';
import {useHandlers} from './hooks/';

interface DynamicList<Item extends object> {
  fields: FieldDictionary<Item>[];
  addField(): void;
  removeField(index: number): void;
}

export function useDynamicList<Item extends object>(
  listOrConfig: FieldListConfig<Item> | Item[],
  fieldFactory: Function,
  validationDependencies: unknown[] = [],
): DynamicList<Item> {
  const calculatedList = Array.isArray(listOrConfig)
    ? listOrConfig
    : listOrConfig.list;
  const validates: FieldListConfig<Item>['validates'] = Array.isArray(
    listOrConfig,
  )
    ? {}
    : listOrConfig.validates || {};
  // const [calculatedList] = useState<Item[]>(initialList);
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
    dispatch(addFieldsAction([fieldFactory()]));
  }

  function removeField(index: number) {
    dispatch(removeFieldsAction(index));
  }

  const handlers = useHandlers(state, dispatch, validationConfigs);

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
