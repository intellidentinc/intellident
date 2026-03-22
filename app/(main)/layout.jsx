import ThemeRegistry from '@/app/providers/ThemeRegistry';
import ToastProvider from '@/app/providers/ToastProvider';
import CryptoProvider from '@/app/providers/CryptoProvider';

const MainLayout = ({ children }) => {
  return (
    <ThemeRegistry>
      <CryptoProvider>
        <ToastProvider>
          <div className="flex-1 flex flex-col bg-[#F8FAFC]">{children}</div>
        </ToastProvider>
      </CryptoProvider>
    </ThemeRegistry>
  );
};

export default MainLayout;
