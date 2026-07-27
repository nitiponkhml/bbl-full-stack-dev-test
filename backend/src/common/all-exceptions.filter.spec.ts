import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function mockHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('passes through an HttpException response body unchanged', () => {
    const { host, status, json } = mockHost();

    filter.catch(new NotFoundException('Collection not found'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Collection not found',
      error: 'Not Found',
    });
  });

  it('passes through a validation BadRequestException with an array message', () => {
    const { host, status, json } = mockHost();

    filter.catch(new BadRequestException(['name should not be empty']), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: ['name should not be empty'],
      error: 'Bad Request',
    });
  });

  it('returns a generic 500 shape (statusCode, message, error) for an unhandled error, without leaking details', () => {
    const { host, status, json } = mockHost();

    filter.catch(new Error('secret internal detail: connection string leaked'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
  });
});
