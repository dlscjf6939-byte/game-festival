//#region src/types/utils.d.ts
type Primitive = null | undefined | string | number | boolean | symbol | bigint;
type BuiltIns = Primitive | void | Date | RegExp;
type ExcludeUndefined<T> = Exclude<T, undefined>;
type HasMultipleCallSignatures<T extends (...arguments_: any[]) => unknown> = T extends {
  (...arguments_: infer A): unknown;
  (...arguments_: infer B): unknown;
} ? B extends A ? A extends B ? false : true : true : false;
type RequiredDeep<T, E extends ExcludeUndefined<T> = ExcludeUndefined<T>> = E extends BuiltIns ? E : E extends Map<infer KeyType, infer ValueType> ? Map<RequiredDeep<KeyType>, RequiredDeep<ValueType>> : E extends Set<infer ItemType> ? Set<RequiredDeep<ItemType>> : E extends ReadonlyMap<infer KeyType, infer ValueType> ? ReadonlyMap<RequiredDeep<KeyType>, RequiredDeep<ValueType>> : E extends ReadonlySet<infer ItemType> ? ReadonlySet<RequiredDeep<ItemType>> : E extends WeakMap<infer KeyType, infer ValueType> ? WeakMap<RequiredDeep<KeyType>, RequiredDeep<ValueType>> : E extends WeakSet<infer ItemType> ? WeakSet<RequiredDeep<ItemType>> : E extends Promise<infer ValueType> ? Promise<RequiredDeep<ValueType>> : E extends ((...arguments_: any[]) => unknown) ? {} extends RequiredObjectDeep<E> ? E : HasMultipleCallSignatures<E> extends true ? E : ((...arguments_: Parameters<E>) => ReturnType<E>) & RequiredObjectDeep<E> : E extends object ? E extends Array<infer ItemType> ? ItemType[] extends E ? Array<RequiredDeep<ItemType>> : RequiredObjectDeep<E> : RequiredObjectDeep<E> : unknown;
type RequiredObjectDeep<ObjectType extends object> = { [KeyType in keyof ObjectType]-?: RequiredDeep<ObjectType[KeyType]> };
//#endregion
export { BuiltIns, HasMultipleCallSignatures, Primitive, RequiredDeep };