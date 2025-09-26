'use client';

import { useState } from 'react';
import { AlertCircle, Archive, Pause, Play, Upload, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Upload as TusUpload } from 'tus-js-client';
import { formatFileSize } from '@/lib/utils/format';

interface MboxUploadProps {
  onFileSelect: (file: File) => void;
  onUploadComplete?: (filepath: string) => void;
  onUploadStatusChange?: (isUploading: boolean) => void;
  selectedFile: File | null;
  disabled?: boolean;
}

export function MboxUpload({
  onFileSelect,
  onUploadComplete,
  onUploadStatusChange,
  selectedFile,
  disabled,
}: MboxUploadProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [currentUpload, setCurrentUpload] = useState<TusUpload | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const handleFileSelect = async (file: File) => {
    console.log('handleFileSelect called with file:', file.name, file.size);

    // Validate file extension
    if (!file.name.endsWith('.mbox')) {
      setUploadError('Please select a valid .mbox file');
      return;
    }

    setUploadError(null);
    console.log('Calling onFileSelect with file:', file);
    onFileSelect(file);

    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    onUploadStatusChange?.(true);
    setUploadProgress(0);
    setUploadError(null);
    setIsPaused(false);

    // Always use TUS for consistent upload experience
    console.log('Starting TUS upload for file:', formatFileSize(file.size));
    startTusUpload(file);
  };

  const startTusUpload = (file: File) => {
    // Build absolute URL to ensure correct protocol (HTTPS in production)
    const endpoint = `${window.location.protocol}//${window.location.host}/api/accounts/upload`;

    const upload = new TusUpload(file, {
      endpoint,
      chunkSize: 10 * 1024 * 1024, // 10MB chunks for better performance
      retryDelays: [0, 1000, 3000, 5000],
      parallelUploads: 1,
      metadata: {
        filename: file.name,
        filetype: file.type || 'application/mbox',
      },
      onError: error => {
        console.error('TUS upload failed:', error);
        setUploadError(`Upload failed: ${error.message || 'Unknown error'}`);
        setIsUploading(false);
        onUploadStatusChange?.(false);
        setUploadProgress(0);
        setCurrentUpload(null);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = (bytesUploaded / bytesTotal) * 100;
        setUploadProgress(Math.round(percentage));
      },
      onSuccess: () => {
        console.log('TUS upload finished, URL:', upload.url);
        // The TUS server stores files with the upload ID as the filename
        // We'll pass the upload ID and let the server construct the path
        const uploadId = upload.url?.split('/').pop() || '';
        // Pass a reference that the server can resolve
        const filepath = `tus:${uploadId}`;
        console.log('Upload complete, reference:', filepath);

        setUploadedPath(filepath);
        setIsUploading(false);
        onUploadStatusChange?.(false);
        setUploadProgress(100);

        // Call onUploadComplete after state updates
        if (onUploadComplete) {
          onUploadComplete(filepath);
        }
      },
      onBeforeRequest: req => {
        // Add authentication header if needed
        const xhr = req.getUnderlyingObject();
        xhr.withCredentials = true;
      },
    });

    setCurrentUpload(upload);

    try {
      upload.start();
    } catch (error) {
      console.error('Failed to start TUS upload:', error);
      setUploadError('Failed to start upload');
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentUpload(null);
    }
  };

  const pauseUpload = () => {
    if (currentUpload) {
      void currentUpload.abort();
      setIsUploading(false);
      setIsPaused(true);
    }
  };

  const resumeUpload = () => {
    if (currentUpload) {
      currentUpload.start();
      setIsUploading(true);
      setIsPaused(false);
    }
  };

  const cancelUpload = () => {
    if (currentUpload) {
      void currentUpload.abort();
      setCurrentUpload(null);
    }
    setIsUploading(false);
    setIsPaused(false);
    setUploadProgress(0);
    setUploadedPath(null);
    onFileSelect(null as unknown as File);
  };


  return (
    <div className='space-y-4'>
      {!selectedFile ? (
        <>
          <Card className='border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors'>
            <CardContent className='p-8'>
              <label
                htmlFor='mboxFile'
                className='cursor-pointer block text-center'
              >
                <input
                  id='mboxFile'
                  type='file'
                  onChange={e => {
                    console.log('File input onChange triggered');
                    const file = e.target.files?.[0];
                    console.log('Selected file:', file);
                    if (file) {
                        void handleFileSelect(file);
                    }
                  }}
                  disabled={disabled}
                  className='hidden'
                />
                <Upload className='h-12 w-12 mx-auto mb-4 text-gray-400' />
                <p className='text-lg font-medium mb-2'>
                  Click to upload or drag and drop
                </p>
                <p className='text-sm text-gray-500'>
                  Mbox files only (max 20GB)
                </p>
              </label>
            </CardContent>
          </Card>

          {/* Show error even when no file is selected */}
          {uploadError && (
            <Card>
              <CardContent className='p-4'>
                <div className='flex items-center text-red-600 text-sm'>
                  <AlertCircle className='h-4 w-4 mr-2' />
                  {uploadError}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className='p-6'>
            <div className='flex items-start justify-between mb-4'>
              <div className='flex items-start space-x-3'>
                <Archive className='h-8 w-8 text-purple-600 mt-1' />
                <div>
                  <p className='font-medium'>{selectedFile.name}</p>
                  <p className='text-sm text-gray-500'>
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
              {!isUploading && !uploadedPath && (
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={cancelUpload}
                  disabled={disabled}
                >
                  <X className='h-4 w-4' />
                </Button>
              )}
            </div>

            {/* Upload Progress */}
            {(isUploading || uploadProgress > 0 || isPaused) &&
              uploadProgress < 100 && (
                <div className='space-y-2'>
                  <div className='flex justify-between text-sm'>
                    <span>Upload Progress</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className='h-2' />

                  {/* Pause/Resume/Cancel controls */}
                  <div className='flex gap-2 mt-2'>
                    {isUploading ? (
                      <Button size='sm' variant='outline' onClick={pauseUpload}>
                        <Pause className='h-4 w-4 mr-1' />
                        Pause
                      </Button>
                    ) : isPaused ? (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={resumeUpload}
                      >
                        <Play className='h-4 w-4 mr-1' />
                        Resume
                      </Button>
                    ) : null}
                    <Button size='sm' variant='outline' onClick={cancelUpload}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

            {/* Upload Complete */}
            {uploadProgress === 100 && uploadedPath && (
              <div className='flex items-center text-green-600 text-sm'>
                <AlertCircle className='h-4 w-4 mr-2' />
                Upload complete! Ready to import.
              </div>
            )}

            {/* Manual Upload Button for files not auto-uploaded */}
            {selectedFile.size >= 10 * 1024 * 1024 &&
              !isUploading &&
              !uploadedPath &&
              !isPaused &&
              uploadProgress === 0 && (
                <Button
                  onClick={() => uploadFile(selectedFile)}
                  disabled={isUploading}
                  className='w-full'
                >
                  <Upload className='h-4 w-4 mr-2' />
                  Upload File
                </Button>
              )}

            {/* Error Display */}
            {uploadError && (
              <div className='space-y-2 mt-2'>
                <div className='flex items-center text-red-600 text-sm'>
                  <AlertCircle className='h-4 w-4 mr-2' />
                  {uploadError}
                </div>
                <div className='flex gap-2'>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      setUploadError(null);
                      void uploadFile(selectedFile);
                    }}
                  >
                    Retry Upload
                  </Button>
                  <Button size='sm' variant='outline' onClick={cancelUpload}>
                    Choose Different File
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
