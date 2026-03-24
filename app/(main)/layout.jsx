import ThemeRegistry from '@/app/providers/ThemeRegistry';
import ToastProvider from '@/app/providers/ToastProvider';
import CryptoProvider from '@/app/providers/CryptoProvider';
import InactivityProvider from '@/app/providers/InactivityProvider';

const MainLayout = ({ children }) => {
  return (
    <ThemeRegistry>
      <CryptoProvider>
        <ToastProvider>
          <InactivityProvider>
            <div className="flex-1 flex flex-col bg-[#F8FAFC]">{children}</div>
          </InactivityProvider>
        </ToastProvider>
      </CryptoProvider>
    </ThemeRegistry>
  );
};

export default MainLayout;
