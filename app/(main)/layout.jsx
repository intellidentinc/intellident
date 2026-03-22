import ThemeRegistry from '@/app/providers/ThemeRegistry';
import ToastProvider from '@/app/providers/ToastProvider';

const MainLayout = ({ children }) => {
  return (
    <ThemeRegistry>
      <ToastProvider>
        <div className="flex-1 flex flex-col bg-[#F8FAFC]">{children}</div>
      </ToastProvider>
    </ThemeRegistry>
  );
};

export default MainLayout;
