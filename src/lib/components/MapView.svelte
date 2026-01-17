<script lang="ts">
	import { onMount } from 'svelte';
	// @ts-ignore - no types available
	import polyline from '@mapbox/polyline';
	import { Focus } from 'lucide-svelte';
	import { COLORS } from '$lib/constants/colors';

	interface Props {
		activity: any;
		selectedSegments: number[];
		hoveredSegment?: number[] | null;
		hoverPoint?: { lat: number; lng: number } | null;
	}

	let { activity, selectedSegments, hoveredSegment = null, hoverPoint = null }: Props = $props();

	let mapContainer: HTMLDivElement;
	let map = $state<any>(null);
	let L: any = null;
	let routeLine: any = null;
	let segmentLines: Map<number, any> = new Map(); // Map segment index to polyline
	let hoverSegmentLines: any[] = []; // Array for multiple hovered segments
	let allCoords: [number, number][] = [];
	let previousSelection: number[] = [];
	let originalBounds: any = null;
	let hoverMarker: any = null;

	function recenterMap() {
		if (map && originalBounds) {
			map.fitBounds(originalBounds);
		}
	}

	onMount(() => {
		// Dynamically import Leaflet only in browser
		(async () => {
			L = (await import('leaflet')).default;
			await import('leaflet/dist/leaflet.css');

			// Initialize map without zoom controls
			map = L.map(mapContainer, {
				zoomControl: false
			}).setView([0, 0], 13);

			// Check dark mode and use appropriate tiles
			const isDarkMode = document.documentElement.classList.contains('dark');

			if (isDarkMode) {
				// Dark Matter tiles for dark mode
				L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
					attribution: '© OpenStreetMap contributors © CARTO',
					maxZoom: 19
				}).addTo(map);
			} else {
				// Positron tiles for light mode
				L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
					attribution: '© OpenStreetMap contributors © CARTO',
					maxZoom: 19
				}).addTo(map);
			}

			// Use detailed stream data if available, otherwise fall back to summary polyline
			if (activity.streams?.latlng?.data) {
				allCoords = activity.streams.latlng.data;
				const latLngs = allCoords.map(([lat, lng]: [number, number]) => L.latLng(lat, lng));

				// Draw main route
				routeLine = L.polyline(latLngs, {
					color: COLORS.baseHex,
					weight: 3,
					opacity: 0.7
				}).addTo(map);

				// Fit bounds to route and store for recenter
				originalBounds = routeLine.getBounds();
				map.fitBounds(originalBounds);
			} else if (activity.map?.summary_polyline) {
				allCoords = polyline.decode(activity.map.summary_polyline);
				const latLngs = allCoords.map(([lat, lng]: [number, number]) => L.latLng(lat, lng));

				// Draw main route
				routeLine = L.polyline(latLngs, {
					color: COLORS.baseHex,
					weight: 3,
					opacity: 0.7
				}).addTo(map);

				// Fit bounds to route and store for recenter
				originalBounds = routeLine.getBounds();
				map.fitBounds(originalBounds);
			}
		})();

		return () => {
			map?.remove();
		};
	});

	// Incrementally update segment highlighting when selection changes
	$effect(() => {
		if (!map || !L || !activity?.segment_efforts || allCoords.length === 0) {
			return;
		}

		// Find segments to add and remove
		const toAdd = new Set<number>();
		const toRemove = new Set<number>();

		// Find newly selected segments
		selectedSegments.forEach((index) => {
			if (!previousSelection.includes(index)) {
				toAdd.add(index);
			}
		});

		// Find deselected segments
		previousSelection.forEach((index) => {
			if (!selectedSegments.includes(index)) {
				toRemove.add(index);
			}
		});

		// Remove deselected segments (instant, no loading needed)
		toRemove.forEach((index) => {
			const line = segmentLines.get(index);
			if (line) {
				line.remove();
				segmentLines.delete(index);
			}
		});

		// Add newly selected segments
		if (toAdd.size > 0) {
			// Use setTimeout to allow UI to stay responsive
			setTimeout(() => {
				toAdd.forEach((index) => {
					const segment = activity.segment_efforts[index];
					const segmentCoords = allCoords.slice(segment.start_index, segment.end_index + 1);

					// Use full coordinates - no simplification
					const line = L.polyline(segmentCoords, {
						color: COLORS.selectedHex,
						weight: 8,
						opacity: 1.0
					}).addTo(map!);

					segmentLines.set(index, line);
				});

				// Bring hover lines to front after adding selected segments
				hoverSegmentLines.forEach((line) => line.bringToFront());
			}, 10);
		}

		// Update previousSelection for next time
		previousSelection = [...selectedSegments];
	});

	// Handle hovered segment highlighting
	$effect(() => {
		if (!map || !L || !activity?.segment_efforts || allCoords.length === 0) {
			return;
		}

		// Remove previous hover lines
		hoverSegmentLines.forEach((line) => line.remove());
		hoverSegmentLines = [];

		// Add hover line(s) if there are hovered segments
		if (hoveredSegment !== null && hoveredSegment.length > 0) {
			// Capture the current hoveredSegment value for the setTimeout closure
			const segmentsToHover = [...hoveredSegment];
			const currentHover = hoveredSegment;

			const addPolylines = () => {
				// Only render if hoveredSegment hasn't changed
				if (hoveredSegment !== currentHover) {
					return;
				}

				segmentsToHover.forEach((segmentIndex) => {
					const segment = activity.segment_efforts[segmentIndex];
					if (segment) {
						const segmentCoords = allCoords.slice(segment.start_index, segment.end_index + 1);
						if (segmentCoords.length > 0) {
							const line = L.polyline(segmentCoords, {
								color: COLORS.hoverHex,
								weight: 6,
								opacity: 0.9,
								className: 'segment-hover'
							}).addTo(map);

							// Ensure hover line is always on top
							line.bringToFront();
							hoverSegmentLines.push(line);
						}
					}
				});
			};

			// Only use setTimeout for multiple segments (expensive), render single segments immediately
			if (segmentsToHover.length > 1) {
				setTimeout(addPolylines, 10);
			} else {
				addPolylines();
			}
		}
	});

	// Handle hover point updates
	$effect(() => {
		if (!map || !L) return;

		if (hoverPoint) {
			// Create or update hover marker
			if (!hoverMarker) {
				hoverMarker = L.circleMarker([hoverPoint.lat, hoverPoint.lng], {
					radius: 6,
					fillColor: COLORS.baseHex,
					fillOpacity: 1,
					color: 'white',
					weight: 2
				}).addTo(map);
			} else {
				hoverMarker.setLatLng([hoverPoint.lat, hoverPoint.lng]);
			}
		} else {
			// Remove hover marker
			if (hoverMarker) {
				hoverMarker.remove();
				hoverMarker = null;
			}
		}
	});
</script>

<div class="relative w-full h-full">
	<div bind:this={mapContainer} class="w-full h-full"></div>

	<!-- Recenter button -->
	<button
		onclick={recenterMap}
		class="absolute top-4 right-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg shadow-lg px-3 py-2 flex items-center gap-2 text-sm font-medium transition-colors z-[1000]"
		title="Recenter map"
	>
		<Focus class="w-4 h-4" />
		<span class="hidden sm:inline">Recenter</span>
	</button>
</div>

<style>
	:global(.leaflet-container) {
		background: #f1f5f9;
	}
	:global(.dark .leaflet-container) {
		background: #1e293b;
	}

	/* Dark mode zoom controls */
	:global(.dark .leaflet-control-zoom a) {
		background-color: #1e293b;
		color: #e2e8f0;
		border-color: #475569;
	}
	:global(.dark .leaflet-control-zoom a:hover) {
		background-color: #334155;
		color: #f1f5f9;
	}

	/* Dark mode attribution */
	:global(.dark .leaflet-control-attribution) {
		background-color: rgba(30, 41, 59, 0.9) !important;
		color: #e2e8f0 !important;
	}
	:global(.dark .leaflet-control-attribution a) {
		color: #cbd5e1 !important;
	}
	:global(.dark .leaflet-control-attribution a:hover) {
		color: #f1f5f9 !important;
	}
</style>
