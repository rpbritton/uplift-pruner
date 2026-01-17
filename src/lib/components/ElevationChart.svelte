<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { COLORS } from '$lib/constants/colors';

	interface Props {
		activity: any;
		selectedSegments: number[];
		hoveredSegment?: number[] | null;
		layout?: 'mobile' | 'desktop';
	}

	let { activity, selectedSegments, hoveredSegment = null, layout = 'desktop' }: Props = $props();

	const dispatch = createEventDispatcher();

	let canvasElement: HTMLCanvasElement;
	let chart: any | null = $state(null);
	let Chart: any = null;
	let indexMap: number[] = [];
	let segmentColorMap: Map<number, string> = new Map(); // Store which color each point should be

	onMount(() => {
		// Dynamically import Chart.js only when needed
		(async () => {
			const ChartModule = await import('chart.js');
			Chart = ChartModule.Chart;
			Chart.register(...ChartModule.registerables);
			
			createChart();
		})();

		// Handle window resize
		const handleResize = () => {
			if (chart) {
				chart.resize();
			}
		};
		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			chart?.destroy();
		};
	});

	// Update chart colors when selection or hover changes
	$effect(() => {
		// Read all dependencies outside the if to ensure they're tracked
		const segments = selectedSegments;
		const hovered = hoveredSegment;
		const currentChart = chart;
		
		if (!currentChart || indexMap.length === 0 || !activity?.segment_efforts) {
			return;
		}

		// Clear and rebuild the color map
		segmentColorMap.clear();
		const selectedColor = COLORS.selected;
		const hoverColor = COLORS.hover;
		
		// Apply selected segments (red)
		activity.segment_efforts.forEach((segment: any, index: number) => {
			if (segments.includes(index)) {
				indexMap.forEach((originalIndex, simplifiedIndex) => {
					if (originalIndex >= segment.start_index && originalIndex <= segment.end_index) {
						segmentColorMap.set(simplifiedIndex, selectedColor);
					}
				});
			}
		});

		// Apply hover color (amber) - overrides selection color
		if (hovered !== null && hovered.length > 0) {
			hovered.forEach(hoveredIndex => {
				if (activity.segment_efforts[hoveredIndex]) {
					const segment = activity.segment_efforts[hoveredIndex];
					indexMap.forEach((originalIndex, simplifiedIndex) => {
						if (originalIndex >= segment.start_index && originalIndex <= segment.end_index) {
							segmentColorMap.set(simplifiedIndex, hoverColor);
						}
					});
				}
			});
		}

		// Update chart
		currentChart.update('none');
	});

	function createChart() {
		if (!Chart || !activity.streams?.altitude?.data || !activity.streams?.distance?.data) {
			return;
		}

		const useImperial = activity?.athlete?.measurement_preference === 'feet';
		const isDarkMode = document.documentElement.classList.contains('dark');
		const textColor = isDarkMode ? '#cbd5e1' : '#475569';
		const gridColor = isDarkMode ? '#475569' : '#e2e8f0';

		// Convert to plain arrays to avoid Svelte reactivity issues with Chart.js
		let altitudes = [...activity.streams.altitude.data];
		let distances = [...activity.streams.distance.data];

		// Convert units if imperial
		if (useImperial) {
			altitudes = altitudes.map((m: number) => m * 3.28084); // meters to feet
			distances = distances.map((m: number) => m / 1609.34); // meters to miles
		} else {
			distances = distances.map((m: number) => m / 1000); // meters to km
		}

		// Simplify data aggressively - take every 20th point for better performance
		const simplifiedAltitudes = [];
		const simplifiedDistances = [];
		indexMap = []; // Track original indices
		
		for (let i = 0; i < altitudes.length; i += 20) {
			simplifiedAltitudes.push(altitudes[i]);
			simplifiedDistances.push(distances[i]);
			indexMap.push(i);
		}
		// Always include last point
		if (indexMap[indexMap.length - 1] !== altitudes.length - 1) {
			simplifiedAltitudes.push(altitudes[altitudes.length - 1]);
			simplifiedDistances.push(distances[distances.length - 1]);
			indexMap.push(altitudes.length - 1);
		}

		// Destroy existing chart
		if (chart) {
			chart.destroy();
		}

		// Create new chart with base colors as arrays - the $effect will handle segment coloring
		const baseColors = new Array(simplifiedAltitudes.length).fill(COLORS.base);
		const baseBgColors = new Array(simplifiedAltitudes.length).fill(COLORS.baseBackground);
		
		chart = new Chart(canvasElement, {
			type: 'line',
			data: {
				labels: simplifiedDistances.map((d: number) => d.toFixed(1)),
				datasets: [
					{
						label: useImperial ? 'Elevation (ft)' : 'Elevation (m)',
						data: simplifiedAltitudes,
						borderWidth: 2,
						segment: {
							borderColor: (ctx: any) => {
								// Use the color map to determine segment color
								const p0Index = ctx.p0DataIndex;
								return segmentColorMap.get(p0Index) || COLORS.base;
							},
							backgroundColor: (ctx: any) => {
								const p0Index = ctx.p0DataIndex;
								const color = segmentColorMap.get(p0Index);
								if (!color) return COLORS.baseBackground;
								if (color === COLORS.selected) return COLORS.selectedBackground;
								if (color === COLORS.hover) return COLORS.hoverBackground;
								return COLORS.baseBackground;
							}
						},
						fill: true,
						tension: 0, // Disable Bézier curves for performance
						pointRadius: 0,
						pointHoverRadius: 0, // Keep points hidden even on hover
						pointHitRadius: 10, // Still allow hovering for tooltip
						hoverBorderWidth: 2, // Keep border width consistent
						spanGaps: true // Critical for performance
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				animations: false,
				transitions: {
					active: {
						animation: {
							duration: 0
						}
					}
				},
				interaction: {
					intersect: false,
					mode: 'index'
				},
				onHover: (event: any, activeElements: any[]) => {
					if (activeElements.length > 0 && activity.streams?.latlng?.data) {
						const dataIndex = activeElements[0].index;
						const originalIndex = indexMap[dataIndex];
						if (originalIndex !== undefined) {
							const latlng = activity.streams.latlng.data[originalIndex];
							if (latlng) {
								dispatch('hoverPoint', { lat: latlng[0], lng: latlng[1], index: originalIndex });
							}
						}
					} else {
						dispatch('hoverPoint', null);
					}
				},
				plugins: {
					legend: {
						display: false
					},
					tooltip: {
						callbacks: {
							title: (items: any) => `Distance: ${items[0].label} ${useImperial ? 'mi' : 'km'}`,
							label: (item: any) => `Elevation: ${Math.round(item.parsed.y as number)} ${useImperial ? 'ft' : 'm'}`,
							labelColor: (context: any) => {
								return {
									borderColor: COLORS.baseHex,
									backgroundColor: COLORS.baseHex
								};
							}
						}
					}
				},
				scales: {
					x: {
						display: layout === 'desktop',
						title: {
							display: layout === 'desktop',
							text: useImperial ? 'Distance (mi)' : 'Distance (km)',
							color: textColor
						},
						ticks: {
							maxTicksLimit: 15,
							color: textColor,
							font: {
								size: 10
							}
						},
						grid: {
							drawOnChartArea: false,
							color: textColor
						},
						border: {
							display: layout === 'desktop',
							color: textColor
						}
					},
					y: {
						display: layout === 'desktop',
						title: {
							display: layout === 'desktop',
							text: useImperial ? 'Elevation (ft)' : 'Elevation (m)',
							color: textColor
						},
						ticks: {
							color: textColor,
							font: {
								size: 10
							}
						},
						grid: {
							drawOnChartArea: false,
							color: textColor
						},
						border: {
							display: layout === 'desktop',
							color: textColor
						}
					}
				}
			}
		});
	}

	function resetZoom() {
		if (chart) {
			chart.resetZoom();
		}
	}

	function handleMouseLeave() {
		dispatch('hoverPoint', null);
	}
</script>

<div class="w-full h-full relative" onmouseleave={handleMouseLeave} role="img" aria-label="Elevation chart">
	<canvas bind:this={canvasElement}></canvas>
</div>
