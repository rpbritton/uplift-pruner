import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

// Initialize theme from localStorage or system preference
function getInitialTheme(): Theme {
	if (!browser) return 'light';
	
	const stored = localStorage.getItem('theme') as Theme | null;
	if (stored === 'light' || stored === 'dark') {
		return stored;
	}
	
	// Check system preference
	if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
		return 'dark';
	}
	
	// Default to light mode
	return 'light';
}

function createThemeStore() {
	const { subscribe, set, update } = writable<Theme>(getInitialTheme());
	
	return {
		subscribe,
		toggle: () => {
			update(current => {
				const newTheme = current === 'light' ? 'dark' : 'light';
				if (browser) {
					localStorage.setItem('theme', newTheme);
					if (newTheme === 'dark') {
						document.documentElement.classList.add('dark');
						document.documentElement.style.backgroundColor = '#0f172a';
					} else {
						document.documentElement.classList.remove('dark');
						document.documentElement.style.backgroundColor = '#f8fafc';
					}
				}
				return newTheme;
			});
		},
		init: () => {
			if (browser) {
				const theme = getInitialTheme();
				if (theme === 'dark') {
					document.documentElement.classList.add('dark');
					document.documentElement.style.backgroundColor = '#0f172a';
				} else {
					document.documentElement.classList.remove('dark');
					document.documentElement.style.backgroundColor = '#f8fafc';
				}
				set(theme);
			}
		}
	};
}

export const theme = createThemeStore();
