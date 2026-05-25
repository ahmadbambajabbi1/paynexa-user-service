import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let usersController: UsersController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {},
        },
      ],
    }).compile();

    usersController = app.get<UsersController>(UsersController);
  });

  describe('health', () => {
    it('should return service status', () => {
      expect(usersController.health()).toEqual({
        service: 'user-service',
        status: 'ok',
      });
    });
  });
});
