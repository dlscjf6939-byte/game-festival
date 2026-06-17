import type {MainStackParamList} from './types';

type TabRouteName = keyof MainStackParamList;
type ScrollToTopHandler = () => void;

const scrollToTopHandlers = new Map<TabRouteName, ScrollToTopHandler>();

export function registerScrollToTopHandler(routeName: TabRouteName, handler: ScrollToTopHandler): () => void {
  scrollToTopHandlers.set(routeName, handler);

  return () => {
    if (scrollToTopHandlers.get(routeName) === handler) {
      scrollToTopHandlers.delete(routeName);
    }
  };
}

export function emitScrollToTop(routeName: TabRouteName): void {
  requestAnimationFrame(() => {
    scrollToTopHandlers.get(routeName)?.();
  });
}
