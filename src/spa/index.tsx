import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import SPA from "./components/SPA";
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import "@fontsource/roboto-condensed";
import "@fontsource/lora";
import "@fontsource/roboto-slab";

const rootElement = document.getElementById('spa');
if (rootElement === null) {
    console.error('Cannot find root element');
} else {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<SPA />)
}
