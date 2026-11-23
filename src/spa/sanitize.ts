import DOMPurify from 'dompurify';
import { marked } from 'marked';

/**
 * Markdown to HTML that is safe to inject: content can arrive from a shared link, so the marked
 * output goes through DOMPurify. Its defaults keep inline styles, images (including data URLs) and
 * the task list checkboxes (input type, checked, disabled); any other kind of input is dropped.
 */
export const markdownToSafeHtml = (markdown: string): string => {
    const fragment = DOMPurify.sanitize(marked(markdown), { RETURN_DOM_FRAGMENT: true });
    fragment.querySelectorAll('input:not([type="checkbox"])').forEach((input) => input.remove());
    const container = document.createElement('div');
    container.appendChild(fragment);
    return container.innerHTML;
};
