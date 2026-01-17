<script lang="ts">
	import { Upload, AlertCircle, Check, Loader2, ExternalLink } from 'lucide-svelte';
	
	let { 
		isOpen = false,
		onClose,
		step = 'idle' as 'idle' | 'saving' | 'ready' | 'verifying' | 'uploading' | 'processing' | 'updating' | 'complete' | 'error',
		progress = 0,
		message = '',
		error = null as { message: string; recoveryUrl?: string } | null,
		newActivityUrl = null as string | null,
		attemptNumber = 0,
		secondsRemaining = 0
	}: {
		isOpen?: boolean;
		onClose: (confirmed?: boolean) => void;
		step?: 'idle' | 'saving' | 'ready' | 'verifying' | 'uploading' | 'processing' | 'updating' | 'complete' | 'error';
		progress?: number;
		message?: string;
		error?: { message: string; recoveryUrl?: string } | null;
		newActivityUrl?: string | null;
		attemptNumber?: number;
		secondsRemaining?: number;
	} = $props();
	
	const steps = [
		{ id: 'saving', label: 'Saving activity details', icon: Check },
		{ id: 'ready', label: 'Ready to delete original', icon: AlertCircle },
		{ id: 'verifying', label: 'Verifying deletion', icon: Loader2 },
		{ id: 'uploading', label: 'Uploading modified activity', icon: Upload },
		{ id: 'processing', label: 'Processing on Strava', icon: Loader2 },
		{ id: 'updating', label: 'Updating activity details', icon: Check },
		{ id: 'complete', label: 'Upload complete!', icon: Check }
	];
	
	function getStepStatus(stepId: string): 'complete' | 'current' | 'pending' | 'error' {
		if (step === 'error') return 'error';
		
		const stepIndex = steps.findIndex(s => s.id === stepId);
		const currentIndex = steps.findIndex(s => s.id === step);
		
		if (stepIndex === -1 || currentIndex === -1) return 'pending';
		
		if (stepIndex < currentIndex) return 'complete';
		if (stepIndex === currentIndex) return 'current';
		return 'pending';
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
		<div class="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
			<!-- Header -->
			<div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
				<h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
					{#if step === 'complete'}
						Upload Complete!
					{:else if step === 'error'}
						Upload Failed
					{:else}
						Uploading to Strava
					{/if}
				</h2>
			</div>
			
			<!-- Content -->
			<div class="px-6 py-4">
				{#if step === 'ready'}
					<!-- Manual Deletion Step -->
					<div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
						<div class="flex items-start gap-3 mb-3">
							<AlertCircle class="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
							<div class="text-sm text-slate-700 dark:text-slate-300">
								<p class="font-medium mb-2">Please Delete Original Activity</p>
								<p class="mb-2">To avoid duplicates, delete the original activity on Strava:</p>
								<ol class="list-decimal list-inside space-y-1 mb-2">
									<li>Click the link below to open the activity</li>
									<li>Click the "..." menu and select "Delete"</li>
									<li>Confirm the deletion</li>
									<li>Return here and click "I've Deleted It"</li>
								</ol>
								<p class="text-xs text-slate-600 dark:text-slate-400 italic mt-2">
									Note: Deleted activities can be restored for 30 days from your Strava profile.
								</p>
							</div>
						</div>
						{#if newActivityUrl}
							<a
								href={newActivityUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-medium px-4 py-2 rounded-lg transition-colors mb-3"
							>
								<ExternalLink class="w-4 h-4" />
								Open Activity on Strava
							</a>
						{/if}
						<div class="flex gap-2">
							<button
								onclick={() => onClose(true)}
								class="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium px-4 py-2.5 rounded-lg transition-colors"
							>
								<Check class="w-4 h-4" />
								I've Deleted It
							</button>
							<button
							onclick={() => onClose(false)}
							class="flex-1 flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-700 text-white font-medium px-4 py-2.5 rounded-lg transition-colors"
						>
								Cancel
							</button>
						</div>
					</div>
				{:else if step === 'error' && error}
					<!-- Error State -->
					<div class="flex flex-col items-center text-center space-y-4">
						<div class="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
							<AlertCircle class="w-6 h-6 text-red-600 dark:text-red-400" />
						</div>
						<div>
							<p class="text-slate-900 dark:text-slate-100 font-medium">{error.message}</p>
							<p class="text-sm text-slate-600 dark:text-slate-400 mt-2">
								The original activity may have been deleted. Check Strava's recently deleted to recover it if needed.
							</p>
						</div>
						{#if error.recoveryUrl}
							<a
								href={error.recoveryUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 rounded-md transition-colors"
							>
								<ExternalLink class="w-4 h-4" />
								View Recently Deleted
							</a>
						{/if}
					</div>
				{:else if step === 'complete' && newActivityUrl}
					<!-- Success State -->
					<div class="flex flex-col items-center text-center space-y-4">
					<div class="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center">
						<Check class="w-6 h-6 text-primary-600 dark:text-primary-400" />
						</div>
						<div>
							<p class="text-slate-900 dark:text-slate-100 font-medium">Activity uploaded successfully!</p>
							<p class="text-sm text-slate-600 dark:text-slate-400 mt-2">
								Your modified activity is now on Strava with uplifts removed.
							</p>
						</div>
						<a
							href={newActivityUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md transition-colors"
						>
							<ExternalLink class="w-4 h-4" />
							View Activity on Strava
						</a>
					</div>
				{:else}
					<!-- Progress Steps -->
					{#key step}
						<div class="space-y-3">
							{#each steps as stepItem}
								{@const status = getStepStatus(stepItem.id)}
								<div class="flex items-center gap-3">
									<div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
									{status === 'complete' ? 'bg-primary-100 dark:bg-primary-900/20' : ''}
									{status === 'current' ? 'bg-primary-100 dark:bg-primary-900/20' : ''}
									{status === 'pending' ? 'bg-slate-100 dark:bg-slate-700' : ''}
									{status === 'error' ? 'bg-red-100 dark:bg-red-900/20' : ''}
								">
									{#if status === 'complete'}
										<Check class="w-5 h-5 text-primary-600 dark:text-primary-400" />
										{:else if status === 'current'}
										<Loader2 class="w-5 h-5 text-primary-600 dark:text-primary-400 animate-spin" />
										{:else}
											<div class="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></div>
										{/if}
									</div>
									<div class="flex-1">
										<p class="text-sm font-medium
										{status === 'complete' ? 'text-primary-600 dark:text-primary-400' : ''}
											{status === 'current' ? 'text-slate-900 dark:text-slate-100' : ''}
											{status === 'pending' ? 'text-slate-500 dark:text-slate-400' : ''}
										">
											{stepItem.label}
											{#if stepItem.id === step && stepItem.id === 'uploading' && attemptNumber > 0}
												<span class="text-xs">(attempt {attemptNumber}/3)</span>
											{/if}

										</p>
									</div>
								</div>
							{/each}
						</div>
					{/key}
					
					<!-- Progress Bar -->
					<div class="mt-4">
						<div class="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
							<div 
							class="h-full bg-primary-600 transition-all duration-300 ease-out"
								style="width: {progress}%"
							></div>
						</div>
						{#if message}
							<p class="text-xs text-slate-600 dark:text-slate-400 mt-2">{message}</p>
						{/if}
					</div>
				{/if}
			</div>
			
			<!-- Footer -->
			<div class="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
				{#if step === 'complete' || step === 'error'}
					<button
						onclick={() => onClose(false)}
						class="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 rounded-md transition-colors"
					>
						Close
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
