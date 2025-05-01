const { updatePassword } = useAuth();

  const handleUpdatePassword = async () => {
    setError(null);
    setSuccessMessage(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (accessToken) {
        console.log('Attempting to update password with token');
        await updatePassword(password);
        setSuccessMessage('Your password has been successfully updated');

        // Перенаправляем на страницу входа после обновления пароля
        setTimeout(() => {
          setIsResetPassword(false);
          setAccessToken(null);
          navigate('/auth');
        }, 2000);
      }
    } catch (err: any) {
      console.error('Password update error:', err);
      setError('Failed to update password. Please try again or request a new password reset link.');
    } finally {
      setLoading(false);
    }
  };