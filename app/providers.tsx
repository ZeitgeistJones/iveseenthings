'use client';
import { RainbowKitProvider, getDefaultConfig, lightTheme, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@rainbow-me/rainbowkit/styles.css';

const config = getDefaultConfig({
  appName: "I've Seen Things",
  projectId: 'b8b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5',
  chains: [base],
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children, dark }: { children: React.ReactNode; dark: boolean }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={dark ? darkTheme({ borderRadius: 'small', accentColor: '#00C4B8' }) : lightTheme({ borderRadius: 'small', accentColor: '#007A74' })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
