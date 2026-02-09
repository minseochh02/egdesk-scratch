/**
 * Recorder Control Window Entry Point
 */

import { createRoot } from 'react-dom/client';
import RecorderControl from './RecorderControl';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(<RecorderControl />);
