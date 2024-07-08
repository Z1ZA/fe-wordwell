interface UserMessageComponentProps {
  message: string;
}

const UserMessageComponent: React.FC<UserMessageComponentProps> = ({
  message,
}) => {
  return (
    <div className="dark:bg-slate-800 bg-white shadow-lg rounded-lg p-4 mt-4 max-w-sm md:max-w-md">
      <div className="flex items-center">
        {/* Render Message component*/}
        <h2 className="text-lg font-semibold flex-grow dark:text-white text-black">
          {message}
        </h2>
      </div>
    </div>
  );
};

export default UserMessageComponent;
