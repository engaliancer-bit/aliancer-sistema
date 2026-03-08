import { useEffect, RefObject } from 'react';

/**
 * Hook personalizado para adicionar navegação por teclado em containers com rolagem horizontal
 *
 * Teclas suportadas:
 * - ArrowLeft/ArrowRight: Rola horizontalmente em incrementos de 100px
 * - Home/End: Vai para o início/fim do scroll horizontal
 * - Shift + ScrollWheel: Converte scroll vertical em horizontal
 *
 * @param ref - Referência ao elemento DOM que terá a rolagem horizontal
 * @param scrollAmount - Quantidade de pixels para rolar por tecla (padrão: 100)
 */
export function useHorizontalKeyboardScroll(
  ref: RefObject<HTMLElement>,
  scrollAmount: number = 100
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Handler para navegação por teclado
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se o usuário está digitando em um input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          if (element.scrollLeft > 0) {
            e.preventDefault();
            element.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
          }
          break;

        case 'ArrowRight':
          if (element.scrollLeft < element.scrollWidth - element.clientWidth) {
            e.preventDefault();
            element.scrollBy({ left: scrollAmount, behavior: 'smooth' });
          }
          break;

        case 'Home':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            element.scrollTo({ left: 0, behavior: 'smooth' });
          }
          break;

        case 'End':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            element.scrollTo({
              left: element.scrollWidth - element.clientWidth,
              behavior: 'smooth',
            });
          }
          break;
      }
    };

    // Handler para scroll com shift
    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey && Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        element.scrollBy({ left: e.deltaY, behavior: 'auto' });
      }
    };

    // Adiciona event listeners
    element.addEventListener('keydown', handleKeyDown);
    element.addEventListener('wheel', handleWheel, { passive: false });

    // Torna o elemento focável se não for
    if (!element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '0');
    }

    // Cleanup
    return () => {
      element.removeEventListener('keydown', handleKeyDown);
      element.removeEventListener('wheel', handleWheel);
    };
  }, [ref, scrollAmount]);
}
